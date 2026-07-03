import React from "react";
import { cn } from "../ui";
import { Sparkles, TrendingUp, AlertTriangle, Cpu, DollarSign } from "lucide-react";

export interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode | string;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = <Sparkles className="size-4 text-primary" />,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  iconClassName = "text-primary",
  titleClassName = "text-primary",
}: DisplayCardProps) {
  let iconElement = icon;
  
  if (typeof icon === 'string') {
      switch (icon) {
          case 'trending-up': iconElement = <TrendingUp className="size-4" />; break;
          case 'alert-triangle': iconElement = <AlertTriangle className="size-4" />; break;
          case 'cpu': iconElement = <Cpu className="size-4" />; break;
          case 'dollar-sign': iconElement = <DollarSign className="size-4" />; break;
          default: iconElement = <Sparkles className="size-4" />;
      }
  }

  return (
    <div
      className={cn(
        "relative flex h-36 w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 bg-black/60 backdrop-blur-md px-4 py-3 transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[20rem] after:bg-gradient-to-l after:from-[#0a0a0a] after:to-transparent after:content-[''] hover:border-white/20 hover:bg-black/80 [&>*]:flex [&>*]:items-center [&>*]:gap-2",
        className
      )}
    >
      <div className="z-10 relative">
        <span className={cn("relative inline-block rounded-full bg-white/5 border border-white/10 p-2", iconClassName)}>
          {iconElement}
        </span>
        <p className={cn("text-lg font-bold tracking-tight", titleClassName)}>{title}</p>
      </div>
      <p className="whitespace-nowrap text-sm text-gray-300 z-10 relative font-medium">{description}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono z-10 relative">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

export function DisplayCards({ cards }: DisplayCardsProps) {
  const defaultCards = [
    {
      className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-black/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-black/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10",
    },
  ];

  const displayCards = cards || defaultCards;

  const processedCards = displayCards.map((cardProps, index) => {
    const baseClass = index === 0 
        ? "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#0a0a0a]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
        : index === 1
        ? "[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#0a0a0a]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
        : "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10";

    return {
        ...cardProps,
        className: cardProps.className || baseClass,
        titleClassName: "text-white",
        iconClassName: "text-primary",
    };
  });

  return (
    <div className="flex w-full items-center justify-center py-6">
      <div className="grid [grid-template-areas:'stack'] place-items-center opacity-100 animate-in fade-in-0 duration-700">
        {processedCards.map((cardProps, index) => (
          <DisplayCard key={index} {...cardProps} />
        ))}
      </div>
    </div>
  );
}

export default DisplayCards;
