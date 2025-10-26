import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, onSearchChange }) => {
  return (
    <div className="relative w-full">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 pointer-events-none">
        <Search size={18} />
      </span>
      <input
        type="text"
        placeholder="Tìm kiếm công việc theo nội dung..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full bg-[#293548] text-slate-200 border border-slate-700 focus:border-indigo-500 focus:ring-0 rounded-lg pl-10 pr-10 py-2 transition"
        aria-label="Search tasks"
      />
      {searchTerm && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
          title="Xóa tìm kiếm"
          aria-label="Clear search"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
