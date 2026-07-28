
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div 
      className={`min-h-screen flex flex-col transition-colors duration-300`} 
      style={{
        background: isDarkMode 
          ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 25%, #1f1f1f 50%, #333333 75%, #222222 100%)' 
          : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 25%, #dee2e6 50%, #ced4da 75%, #adb5bd 100%)'
      }}
    >
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleTheme} 
          className={`border-2 hover:scale-105 transition-all duration-200 ${isDarkMode 
            ? 'bg-gray-800/50 text-white border-gray-600 hover:bg-gray-700/50 backdrop-blur-sm' 
            : 'bg-white/50 text-gray-800 border-gray-300 hover:bg-gray-100/50 backdrop-blur-sm'}`}
        >
          {isDarkMode ? <Sun className="mr-1 sm:mr-2 h-4 w-4" /> : <Moon className="mr-1 sm:mr-2 h-4 w-4" />}
          <span className="hidden sm:inline">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center">
        {/* 404 Number */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-bold text-[#FD5757] drop-shadow-lg animate-pulse">
            404
          </h1>
        </div>
        
        {/* Error Message */}
        <div className="max-w-md sm:max-w-lg lg:max-w-xl space-y-4 sm:space-y-6">
          <h2 className={`text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Page Not Found
          </h2>
          <p className={`text-sm sm:text-base lg:text-lg leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-sm sm:max-w-none mx-auto">
          <Button 
            asChild 
            className="h-11 sm:h-12 bg-[#FD5757] hover:bg-[#E04747] text-white hover:scale-[1.02] transition-all duration-200 text-sm sm:text-base font-semibold"
          >
            <Link to="/" className="flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              Go to Homepage
            </Link>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className={`h-11 sm:h-12 hover:scale-[1.02] transition-all duration-200 text-sm sm:text-base font-semibold flex items-center justify-center gap-2 ${isDarkMode 
              ? 'border-gray-600 text-white hover:bg-gray-700/50 backdrop-blur-sm bg-gray-800/50' 
              : 'text-gray-800 hover:bg-gray-100/50 backdrop-blur-sm bg-white/50 border-gray-300'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
      
      {/* Footer */}
      <footer className={`w-full py-4 sm:py-6 transition-colors duration-300 ${isDarkMode 
        ? 'bg-gray-900/50 text-gray-400 backdrop-blur-sm' 
        : 'bg-white/50 text-gray-600 backdrop-blur-sm'}`}>
        <div className="container mx-auto px-4 text-center">
          <div className="text-sm sm:text-base">
            © 2025 Activa Reforce
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NotFound;
