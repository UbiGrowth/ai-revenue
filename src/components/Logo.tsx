import ubigrowthLogo from "@/assets/ubigrowth-logo.png";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

const Logo = ({ className = "h-8", showTagline = false }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={ubigrowthLogo} 
        alt="UbiGrowth AI Logo" 
        className="h-full w-auto"
      />
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-ubigrowth">
          UbiGrowth AI
        </span>
        {showTagline && (
          <span className="text-xs text-muted-foreground">
            AI-Powered Marketing Platform
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
