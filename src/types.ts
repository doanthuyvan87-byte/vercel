export interface WordClue {
  word: string;
  clue: string;
}

export interface PlacedWord {
  word: string;
  clue: string;
  x: number;
  y: number;
  direction: 'across' | 'down';
  number: number;
}

export interface GridCell {
  char: string;
  wordNumbers: number[];
  isStartOfWord: boolean;
  startNumber?: number;
}

export interface CrosswordData {
  grid: (GridCell | null)[][];
  placedWords: PlacedWord[];
  unplacedWords: WordClue[];
  width: number;
  height: number;
}
