import { CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  label: string;
  status: "completed" | "current" | "upcoming";
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  className?: string;
}

const WorkflowProgress = ({ steps, className }: WorkflowProgressProps) => {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-4", className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                step.status === "completed" &&
                  "bg-green-500 border-green-500 text-white",
                step.status === "current" &&
                  "bg-primary border-primary text-primary-foreground animate-pulse",
                step.status === "upcoming" &&
                  "bg-background border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {step.status === "completed" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                step.status === "completed" && "text-green-500",
                step.status === "current" && "text-primary",
                step.status === "upcoming" && "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-12 h-0.5 mx-2 transition-all",
                step.status === "completed"
                  ? "bg-green-500"
                  : "bg-muted-foreground/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default WorkflowProgress;
