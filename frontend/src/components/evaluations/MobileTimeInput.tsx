
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface MobileTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MobileTimeInput: React.FC<MobileTimeInputProps> = ({
  value,
  onChange,
  className
}) => {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  // Parse HH:MM:SS value into separate fields
  useEffect(() => {
    if (value && value.includes(':')) {
      const parts = value.split(':');
      setHours(parts[0] || '');
      setMinutes(parts[1] || '');
      setSeconds(parts[2] || '');
    } else {
      setHours('');
      setMinutes('');
      setSeconds('');
    }
  }, [value]);

  const formatAndCombine = (h: string, m: string, s: string) => {
    // Default empty values to "00"
    const formattedHours = h.padStart(2, '0');
    const formattedMinutes = Math.min(parseInt(m) || 0, 59).toString().padStart(2, '0');
    const formattedSeconds = Math.min(parseInt(s) || 0, 59).toString().padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  };

  const handleBlur = () => {
    // Only format and update if at least one field has a value
    if (hours || minutes || seconds) {
      const formatted = formatAndCombine(hours, minutes, seconds);
      onChange(formatted);
    } else {
      // If all fields are empty, clear the value
      onChange('');
    }
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    setHours(newValue);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    // Limit input to 2 digits for minutes
    if (newValue.length <= 2) {
      setMinutes(newValue);
    }
  };

  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    // Limit input to 2 digits for seconds
    if (newValue.length <= 2) {
      setSeconds(newValue);
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1">
        <Input
          type="tel"
          inputMode="numeric"
          value={hours}
          onChange={handleHoursChange}
          onBlur={handleBlur}
          placeholder="HH"
          className="w-12 text-center"
          maxLength={3}
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="tel"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          onBlur={handleBlur}
          placeholder="MM"
          className="w-12 text-center"
          maxLength={2}
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="tel"
          inputMode="numeric"
          value={seconds}
          onChange={handleSecondsChange}
          onBlur={handleBlur}
          placeholder="SS"
          className="w-12 text-center"
          maxLength={2}
        />
      </div>
    </div>
  );
};
