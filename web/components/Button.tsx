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
  const baseStyles = "inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-[10px] text-sm font-semibold transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:ring-offset-2 dark:focus:ring-offset-[#070B14] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const variants = {
    primary: "bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-md shadow-blue-500/20 hover:opacity-95 border border-transparent",
    secondary: "bg-white dark:bg-[#1E293B] text-[#172033] dark:text-[#CBD5E1] border border-[#DCE3EC] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] shadow-sm",
    outline: "border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10 dark:hover:bg-[#2563EB]/20",
    danger: "bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#F87171]/10 dark:text-[#F87171] border border-[#DC2626]/20 dark:border-[#F87171]/20 hover:bg-[#DC2626]/20 dark:hover:bg-[#F87171]/20"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon && <span className="w-5 h-5 shrink-0 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;