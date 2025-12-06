import React, { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { TANZANIAN_REGIONS, getDistrictsByRegion, getAllLocations } from '../utils/locations';

interface LocationDropdownProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showFullLocation?: boolean; // If true, shows "District, Region" format
}

export const LocationDropdown: React.FC<LocationDropdownProps> = ({
  value = '',
  onChange,
  placeholder = 'Select location',
  className = '',
  showFullLocation = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  // If value exists, parse it
  React.useEffect(() => {
    if (value && showFullLocation) {
      const parts = value.split(', ');
      if (parts.length === 2) {
        setSelectedRegion(parts[1]);
        setSelectedDistrict(parts[0]);
      }
    } else if (value) {
      // Try to find if it's a region
      if (TANZANIAN_REGIONS.includes(value)) {
        setSelectedRegion(value);
      }
    }
  }, [value, showFullLocation]);

  const handleRegionSelect = (region: string) => {
    setSelectedRegion(region);
    setSelectedDistrict('');
    if (!showFullLocation) {
      onChange(region);
      setIsOpen(false);
    }
  };

  const handleDistrictSelect = (district: string) => {
    setSelectedDistrict(district);
    if (showFullLocation) {
      onChange(`${district}, ${selectedRegion}`);
    } else {
      onChange(district);
    }
    setIsOpen(false);
  };

  const displayValue = showFullLocation && selectedDistrict && selectedRegion
    ? `${selectedDistrict}, ${selectedRegion}`
    : selectedDistrict || selectedRegion || value || placeholder;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white ${
          value ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="truncate">{displayValue}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl max-h-96 overflow-hidden">
            {!selectedRegion ? (
              // Region Selection
              <div className="overflow-y-auto max-h-96 custom-scrollbar">
                {TANZANIAN_REGIONS.map(region => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => handleRegionSelect(region)}
                    className="w-full px-4 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm text-neutral-900 dark:text-white flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4 text-neutral-400" />
                    {region}
                  </button>
                ))}
              </div>
            ) : (
              // District Selection
              <div className="overflow-y-auto max-h-96 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegion('');
                    setSelectedDistrict('');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800"
                >
                  ← Back to Regions
                </button>
                <div className="px-4 py-2 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase bg-neutral-50 dark:bg-neutral-950">
                  {selectedRegion}
                </div>
                {getDistrictsByRegion(selectedRegion).map(district => (
                  <button
                    key={district}
                    type="button"
                    onClick={() => handleDistrictSelect(district)}
                    className="w-full px-4 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm text-neutral-900 dark:text-white flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4 text-neutral-400" />
                    {district}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

