import React from 'react';
import { motion } from 'motion/react';
import { CrosswordData, PlacedWord } from '../types';

interface CrosswordGridProps {
  data: CrosswordData;
  userGrid: string[][];
  revealed: boolean;
  checked: boolean;
  onWordClick: (word: PlacedWord) => void;
}

const CrosswordGrid: React.FC<CrosswordGridProps> = ({ data, userGrid, revealed, checked, onWordClick }) => {
  const handleCellClick = (x: number, y: number) => {
    const cell = data.grid[y][x];
    if (!cell) return;

    // Find the first word associated with this cell
    const wordNumber = cell.wordNumbers[0];
    const word = data.placedWords.find(w => w.number === wordNumber);
    if (word) {
      onWordClick(word);
    }
  };

  return (
    <div 
      className="grid gap-0 p-8 bg-white rounded-2xl shadow-inner overflow-auto max-w-full border-4 border-slate-100"
      style={{ 
        gridTemplateColumns: `repeat(${data.width}, 44px)`,
        gridAutoRows: '44px',
        width: 'fit-content',
        margin: '0 auto'
      }}
    >
      {data.grid.map((row, y) => (
        row.map((cell, x) => (
          <motion.div 
            key={`${x}-${y}`} 
            whileHover={cell ? { scale: 1.05, zIndex: 10 } : {}}
            onClick={() => handleCellClick(x, y)}
            className={`crossword-cell relative flex items-center justify-center cursor-pointer transition-all duration-200 ${
              cell 
                ? 'bg-white hover:bg-sky-50 border-2 border-sky-200 -ml-[2px] -mt-[2px] shadow-sm rounded-lg' 
                : 'bg-transparent'
            }`}
            style={{
              zIndex: cell ? 1 : 0
            }}
          >
            {cell && (
              <>
                {cell.isStartOfWord && (
                  <span className="absolute top-1 left-1 text-[11px] font-black text-sky-400 leading-none select-none">
                    {cell.startNumber}
                  </span>
                )}
                <span className={`text-2xl font-black uppercase select-none tracking-tighter ${
                  revealed ? 'text-sky-600' : 
                  checked && userGrid[y][x] !== '' ? 
                    (userGrid[y][x] === cell.char ? 'text-emerald-500' : 'text-rose-500') : 
                    'text-slate-800'
                }`}>
                  {revealed ? cell.char : userGrid[y][x]}
                </span>
              </>
            )}
          </motion.div>
        ))
      ))}
    </div>
  );
};

export default CrosswordGrid;
