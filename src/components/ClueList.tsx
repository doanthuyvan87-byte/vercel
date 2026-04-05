import React from 'react';
import { motion } from 'motion/react';
import { PlacedWord } from '../types';

interface ClueListProps {
  placedWords: PlacedWord[];
}

const ClueList: React.FC<ClueListProps> = ({ placedWords }) => {
  const across = placedWords.filter(w => w.direction === 'across').sort((a, b) => a.number - b.number);
  const down = placedWords.filter(w => w.direction === 'down').sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-8 bg-sky-400 rounded-full shadow-sm"></div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-wider">Hàng Ngang</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {across.map(word => (
            <motion.div 
              key={`across-${word.number}`} 
              whileHover={{ x: 5 }}
              className="group flex gap-3 p-3 rounded-2xl hover:bg-sky-50 transition-all border-2 border-transparent hover:border-sky-100"
            >
              <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-sky-100 group-hover:bg-sky-500 group-hover:text-white rounded-xl text-lg font-black transition-all shadow-sm">
                {word.number}
              </span>
              <p className="text-slate-600 leading-tight font-bold pt-1 text-lg">
                {word.clue}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-8 bg-amber-400 rounded-full shadow-sm"></div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-wider">Hàng Dọc</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {down.map(word => (
            <motion.div 
              key={`down-${word.number}`} 
              whileHover={{ x: 5 }}
              className="group flex gap-3 p-3 rounded-2xl hover:bg-amber-50 transition-all border-2 border-transparent hover:border-amber-100"
            >
              <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-amber-100 group-hover:bg-amber-500 group-hover:text-white rounded-xl text-lg font-black transition-all shadow-sm">
                {word.number}
              </span>
              <p className="text-slate-600 leading-tight font-bold pt-1 text-lg">
                {word.clue}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClueList;
