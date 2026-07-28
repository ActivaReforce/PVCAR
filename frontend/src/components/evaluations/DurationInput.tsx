
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface DurationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const DurationInput: React.FC<DurationInputProps> = ({
  value,
  onChange,
  placeholder = "h:mm:ss",
  className
}) => {
  const [displayValue, setDisplayValue] = useState(value);

  // Update display value when external value changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const formatDuration = (input: string): string => {
    // Remove any non-numeric and non-colon characters
    const cleaned = input.replace(/[^0-9:]/g, '');
    
    if (!cleaned) return '';
    
    // Split by colons and filter out empty strings
    const parts = cleaned.split(':').filter(part => part !== '');
    
    if (parts.length === 0) return '';
    
    // Convert all parts to numbers
    const numbers = parts.map(part => parseInt(part, 10) || 0);
    
    let hours = 0, minutes = 0, seconds = 0;
    
    if (numbers.length === 1) {
      // Single number - could be seconds or minutes depending on value
      const num = numbers[0];
      if (num < 60) {
        seconds = num;
      } else {
        // Treat as MMss format (e.g., 215 = 2:15)
        const str = num.toString().padStart(3, '0');
        if (str.length === 3) {
          minutes = parseInt(str.substring(0, 1), 10);
          seconds = parseInt(str.substring(1, 3), 10);
        } else if (str.length === 4) {
          minutes = parseInt(str.substring(0, 2), 10);
          seconds = parseInt(str.substring(2, 4), 10);
        } else if (str.length === 5) {
          // Treat as HMMss format (e.g., 10302 = 1:03:02)
          hours = parseInt(str.substring(0, 1), 10);
          minutes = parseInt(str.substring(1, 3), 10);
          seconds = parseInt(str.substring(3, 5), 10);
        }
      }
    } else if (numbers.length === 2) {
      // Two parts: minutes:seconds
      minutes = numbers[0];
      seconds = numbers[1];
    } else if (numbers.length >= 3) {
      // Three or more parts: hours:minutes:seconds
      hours = numbers[0];
      minutes = numbers[1];
      seconds = numbers[2];
    }
    
    // Normalize overflow (e.g., 90 seconds becomes 1:30)
    if (seconds >= 60) {
      minutes += Math.floor(seconds / 60);
      seconds = seconds % 60;
    }
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }
    
    // Format to HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
  };

  const handleBlur = () => {
    const formatted = formatDuration(displayValue);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
    onChange(formatted);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow only numbers and colons
    if (!/[0-9:]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <Input
      value={displayValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      onKeyPress={handleKeyPress}
      placeholder={placeholder}
      className={className}
      inputMode="numeric"
      pattern="[0-9:]*"
      enterKeyHint="done"
    />
  );
};
