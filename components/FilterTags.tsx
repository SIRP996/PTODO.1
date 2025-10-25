import React from 'react';

interface FilterTagsProps {
  hashtags: string[];
  activeHashtag: string | null;
  onSelectHashtag: (hashtag: string | null) => void;
  hashtagStatuses: { [key: string]: 'overdue' | 'pending' | 'completed' };
}

const FilterTags: React.FC<FilterTagsProps> = ({ hashtags, activeHashtag, onSelectHashtag, hashtagStatuses }) => {
  const getTagClasses = (tag: string) => {
    const status = hashtagStatuses[tag];
    const isActive = activeHashtag === tag;

    if (isActive) {
      return 'bg-indigo-500 text-white';
    }

    switch (status) {
      case 'overdue':
        return 'bg-red-800/80 text-red-200 hover:bg-red-700 blinking';
      case 'pending':
        return 'bg-amber-800/80 text-amber-200 hover:bg-amber-700';
      case 'completed':
        return 'bg-emerald-800/80 text-emerald-200 hover:bg-emerald-700';
      default:
        return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-md font-semibold mb-3 text-slate-400">Lọc theo thẻ</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectHashtag(null)}
          className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
            activeHashtag === null
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Tất cả
        </button>
        {hashtags.map(tag => (
          <button
            key={tag}
            onClick={() => onSelectHashtag(tag)}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${getTagClasses(tag)}`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterTags;