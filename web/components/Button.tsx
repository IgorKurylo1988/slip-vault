import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-gradient-to-r from-[#1D4ED8] to-[#4F46E5] dark:from-[#2563EB] dark:to-[#4F46E5] text-white shadow-lg shadow-blue-500/25 hover:opacity-95 border border-transparent active:scale-[0.98]",
    secondary: "bg-[#FFFFFF] dark:bg-[#1E293B] text-[#172033] dark:text-[#CBD5E1] border border-[#DCE3EC] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#334155]/50 shadow-sm",
    outline: "border-2 border-[#1D4ED8] dark:border-[#2563EB] text-[#1D4ED8] dark:text-[#2563EB] hover:bg-[#1D4ED8]/10 dark:hover:bg-[#2563EB]/10",
    danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;