import { WordClue, CrosswordData, PlacedWord, GridCell } from '../types';

export function generateCrossword(wordClues: WordClue[]): CrosswordData | null {
  const normalizedWords = wordClues.map(wc => ({ 
    ...wc, 
    word: wc.word.toUpperCase().normalize('NFC').replace(/\s+/g, '') 
  }));

  if (normalizedWords.length === 0) return null;

  let bestResult: CrosswordData | null = null;
  let bestScore = -Infinity;

  // Try many attempts to find the most connected grid
  const attempts = 100;
  
  for (let attempt = 0; attempt < attempts; attempt++) {
    const shuffled = [...normalizedWords];
    // First 10 attempts: sort by length (usually best)
    if (attempt < 10) {
      shuffled.sort((a, b) => b.word.length - a.word.length);
      const startIdx = attempt % Math.min(shuffled.length, 5);
      [shuffled[0], shuffled[startIdx]] = [shuffled[startIdx], shuffled[0]];
    } else {
      // Other attempts: random shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    
    const result = tryGenerate(shuffled);
    if (result) {
      const score = calculateScore(result);
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }
  }

  return bestResult;
}

function calculateScore(data: CrosswordData): number {
  const placedCount = data.placedWords.length;
  const unplacedCount = data.unplacedWords.length;
  
  // Count total intersections
  let intersections = 0;
  const grid = data.grid;
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      if (grid[y][x] && grid[y][x]!.wordNumbers.length > 1) {
        intersections++;
      }
    }
  }

  // Primary goal: place as many words as possible
  // Secondary goal: maximize intersections
  // Tertiary goal: compact grid
  return (placedCount * 1000) - (unplacedCount * 5000) + (intersections * 100) - (data.width * data.height);
}

function tryGenerate(wordClues: WordClue[]): CrosswordData | null {
  const placedWords: PlacedWord[] = [];
  const unplacedWords: WordClue[] = [];
  
  // Use a large virtual grid for placement
  const V_SIZE = 100;
  const vGrid: (string | null)[][] = Array.from({ length: V_SIZE }, () => Array(V_SIZE).fill(null));

  const placeOnVGrid = (word: string, x: number, y: number, dir: 'across' | 'down') => {
    for (let i = 0; i < word.length; i++) {
      const tx = dir === 'across' ? x + i : x;
      const ty = dir === 'down' ? y + i : y;
      vGrid[ty][tx] = word[i];
    }
  };

  const canPlace = (word: string, x: number, y: number, dir: 'across' | 'down'): boolean => {
    if (x < 1 || y < 1 || (dir === 'across' && x + word.length >= V_SIZE - 1) || (dir === 'down' && y + word.length >= V_SIZE - 1)) {
      return false;
    }

    let hasIntersection = false;

    for (let i = 0; i < word.length; i++) {
      const tx = dir === 'across' ? x + i : x;
      const ty = dir === 'down' ? y + i : y;

      // Check current cell
      if (vGrid[ty][tx] !== null) {
        if (vGrid[ty][tx] !== word[i]) return false;
        hasIntersection = true;
      } else {
        // Check neighbors to avoid illegal touches
        const neighbors = dir === 'across' 
          ? [{nx: tx, ny: ty-1}, {nx: tx, ny: ty+1}] // Check top/bottom for across
          : [{nx: tx-1, ny: ty}, {nx: tx+1, ny: ty}]; // Check left/right for down
        
        for (const {nx, ny} of neighbors) {
          if (vGrid[ny][nx] !== null) return false;
        }

        // Check ends
        if (i === 0) {
          const prevX = dir === 'across' ? tx - 1 : tx;
          const prevY = dir === 'down' ? ty - 1 : ty;
          if (vGrid[prevY][prevX] !== null) return false;
        }
        if (i === word.length - 1) {
          const nextX = dir === 'across' ? tx + 1 : tx;
          const nextY = dir === 'down' ? ty + 1 : ty;
          if (vGrid[nextY][nextX] !== null) return false;
        }
      }
    }

    return placedWords.length === 0 || hasIntersection;
  };

  // Place first word
  const first = wordClues[0];
  const startX = Math.floor(V_SIZE / 2) - Math.floor(first.word.length / 2);
  const startY = Math.floor(V_SIZE / 2);
  placeOnVGrid(first.word, startX, startY, 'across');
  placedWords.push({ ...first, x: startX, y: startY, direction: 'across', number: 0 });

  // Try placing others
  for (let i = 1; i < wordClues.length; i++) {
    const current = wordClues[i];
    let bestP: PlacedWord | null = null;
    
    // Find all possible intersections
    const possiblePlacements: PlacedWord[] = [];

    for (const placed of placedWords) {
      for (let j = 0; j < current.word.length; j++) {
        for (let k = 0; k < placed.word.length; k++) {
          if (current.word[j] === placed.word[k]) {
            const dir: 'across' | 'down' = placed.direction === 'across' ? 'down' : 'across';
            const px = dir === 'across' ? placed.x - j : placed.x;
            const py = dir === 'down' ? placed.y - j : placed.y;
            
            // Adjust px/py based on intersection point k
            const finalX = dir === 'across' ? px : placed.x;
            const finalY = dir === 'down' ? py : placed.y;
            
            // Wait, logic for intersection point:
            // If placed is ACROSS at (px, py), intersection is at (px+k, py)
            // If current is DOWN, it must pass through (px+k, py) at index j
            // So current starts at (px+k, py-j)
            const cx = placed.direction === 'across' ? placed.x + k : placed.x;
            const cy = placed.direction === 'across' ? placed.y : placed.y + k;
            
            const startX = dir === 'across' ? cx - j : cx;
            const startY = dir === 'down' ? cy - j : cy;

            if (canPlace(current.word, startX, startY, dir)) {
              possiblePlacements.push({ ...current, x: startX, y: startY, direction: dir, number: 0 });
            }
          }
        }
      }
    }

    if (possiblePlacements.length > 0) {
      // Pick placement that doesn't make grid too large or has most intersections
      bestP = possiblePlacements[Math.floor(Math.random() * possiblePlacements.length)];
      placeOnVGrid(bestP.word, bestP.x, bestP.y, bestP.direction);
      placedWords.push(bestP);
    } else {
      unplacedWords.push(current);
    }
  }

  if (placedWords.length === 0) return null;

  // Normalize and build final grid
  let minX = V_SIZE, minY = V_SIZE, maxX = 0, maxY = 0;
  placedWords.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    if (p.direction === 'across') {
      maxX = Math.max(maxX, p.x + p.word.length - 1);
      maxY = Math.max(maxY, p.y);
    } else {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y + p.word.length - 1);
    }
  });

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const normalizedPlacedWords = placedWords.map(p => ({
    ...p,
    x: p.x - minX,
    y: p.y - minY
  }));

  // Assign numbers
  const sortedByPos = [...normalizedPlacedWords].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  let currentNum = 1;
  const posToNum: Record<string, number> = {};
  sortedByPos.forEach(p => {
    const key = `${p.x},${p.y}`;
    if (!posToNum[key]) posToNum[key] = currentNum++;
    p.number = posToNum[key];
  });

  const grid: (GridCell | null)[][] = Array.from({ length: height }, () => Array(width).fill(null));
  normalizedPlacedWords.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      const x = p.direction === 'across' ? p.x + i : p.x;
      const y = p.direction === 'down' ? p.y + i : p.y;
      if (!grid[y][x]) grid[y][x] = { char: p.word[i], wordNumbers: [], isStartOfWord: false };
      grid[y][x]!.wordNumbers.push(p.number);
      if (i === 0) {
        grid[y][x]!.isStartOfWord = true;
        grid[y][x]!.startNumber = p.number;
      }
    }
  });

  return { grid, placedWords: normalizedPlacedWords, unplacedWords, width, height };
}
