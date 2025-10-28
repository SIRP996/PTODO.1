import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, MoreHorizontal, X } from 'lucide-react';

interface FilterTagsProps {
  hashtags: string[];
  activeHashtag: string | null;
  onSelectHashtag: (hashtag: string | null) => void;
  hashtagStatuses: { [key: string]: 'overdue' | 'pending' | 'completed' };
}

const VISIBLE_TAG_LIMIT = 6; // Max number of tags to show before the "More" button

const FilterTags: React.FC<FilterTagsProps> = ({ hashtags, activeHashtag, onSelectHashtag, hashtagStatuses }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const sortedHashtags = useMemo(() => {
    const statusPriority = {
      'overdue': 1,
      'pending': 2,
      'completed': 3,
    };
    return [...hashtags].sort((a, b) => {
      const statusA = hashtagStatuses[a] || 'completed';
      const statusB = hashtagStatuses[b] || 'completed';
      if ((statusPriority[statusA] || 4) !== (statusPriority[statusB] || 4)) {
        return (statusPriority[statusA] || 4) - (statusPriority[statusB] || 4);
      }
      return a.localeCompare(b); // Alphabetical sort for same-status tags
    });
  }, [hashtags, hashtagStatuses]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const getTagClasses = (tag: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-indigo-500 text-white';
    }
    const status = hashtagStatuses[tag];
    switch (status) {
      case 'overdue': return 'bg-red-800/80 text-red-200 hover:bg-red-700 blinking';
      case 'pending': return 'bg-amber-800/80 text-amber-200 hover:bg-amber-700';
      case 'completed': return 'bg-emerald-800/80 text-emerald-200 hover:bg-emerald-700';
      default: return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }
  };
  
  const visibleTags = sortedHashtags.slice(0, VISIBLE_TAG_LIMIT);
  const hasMoreTags = sortedHashtags.length > VISIBLE_TAG_LIMIT;

  const filteredPopoverTags = sortedHashtags.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="mb-4">
      <h3 className="text-md font-semibold mb-3 text-slate-400">Lọc theo thẻ</h3>
      <div className="relative flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelectHashtag(null)}
          className={`px-3 py-1 text-sm font-medium rounded-full transition-colors self-start ${
            activeHashtag === null
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Tất cả
        </button>
        {visibleTags.map(tag => (
          <button
            key={tag}
            onClick={() => onSelectHashtag(tag)}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${getTagClasses(tag, activeHashtag === tag)}`}
          >
            #{tag}
          </button>
        ))}

        {hasMoreTags && (
            <>
                <button
                    onClick={() => setIsPopoverOpen(true)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors"
                    title="Tìm kiếm thẻ"
                >
                    <Search size={14} />
                </button>
                <button
                    onClick={() => setIsPopoverOpen(true)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors"
                    title="Xem tất cả thẻ"
                >
                    <MoreHorizontal size={14} />
                </button>
            </>
        )}
      </div>

      {isPopoverOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div ref={popoverRef} className="bg-[#1E293B] w-full max-w-sm rounded-xl shadow-2xl border border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Search size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Tìm kiếm thẻ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-indigo-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition"
                        autoFocus
                    />
                </div>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
                {filteredPopoverTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {filteredPopoverTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => {
                                    onSelectHashtag(tag);
                                    setIsPopoverOpen(false);
                                    setSearchTerm('');
                                }}
                                className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${getTagClasses(tag, activeHashtag === tag)}`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-slate-500 py-4">Không tìm thấy thẻ nào.</p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterTags;