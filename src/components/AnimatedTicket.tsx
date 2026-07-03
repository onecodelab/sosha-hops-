import * as React from "react";
import { cn, Badge } from "./ui";
import { CheckCircle2, ShieldCheck, Activity } from "lucide-react";

// --- SVG Icons ---

const MastercardIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="36"
        height="24"
    >
        <circle cx="8" cy="12" r="7" fill="#EA001B"></circle>
        <circle cx="16" cy="12" r="7" fill="#F79E1B" fillOpacity="0.8"></circle>
    </svg>
);


// --- Helper Components ---

const DashedLine = () => (
    <div
        className="w-full border-t-2 border-dashed border-primary/10 my-4"
        aria-hidden="true"
    />
);

const Barcode = ({ value }: { value: string }) => {
    const hashCode = (s: string) => s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const seed = hashCode(value);
    const random = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    const bars = Array.from({ length: 60 }).map((_, index) => {
        const rand = random(seed + index);
        const width = rand > 0.7 ? 2.5 : 1.5;
        return { width };
    });

    const spacing = 1.5;
    const totalWidth = bars.reduce((acc, bar) => acc + bar.width + spacing, 0) - spacing;
    const svgWidth = 250;
    const svgHeight = 60;
    let currentX = (svgWidth - totalWidth) / 2;

    return (
        <div className="flex flex-col items-center py-2">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                aria-label={`Barcode for value ${value}`}
                className="fill-current text-gray-500"
            >
                {bars.map((bar, index) => {
                    const x = currentX;
                    currentX += bar.width + spacing;
                    return (
                        <rect
                            key={index}
                            x={x}
                            y="5"
                            width={bar.width}
                            height="50"
                        />
                    );
                })}
            </svg>
            <p className="text-[10px] text-gray-600 tracking-[0.5em] mt-2 font-mono uppercase">{value}</p>
        </div>
    );
};

const ConfettiExplosion = () => {
    const confettiCount = 100;
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#f97316"];

    return (
        <>
            <style>
                {`
          @keyframes finish_fall {
            0% {
                transform: translateY(-10vh) rotate(0deg);
                opacity: 1;
            }
            100% {
              transform: translateY(110vh) rotate(720deg);
              opacity: 0;
            }
          }
        `}
            </style>
            <div className="fixed inset-0 z-[100] pointer-events-none" aria-hidden="true">
                {Array.from({ length: confettiCount }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1.5 h-3"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${-20 + Math.random() * 10}%`,
                            backgroundColor: colors[i % colors.length],
                            transform: `rotate(${Math.random() * 360}deg)`,
                            animation: `finish_fall ${2.5 + Math.random() * 2.5}s ${Math.random() * 0.5}s linear forwards`,
                        }}
                    />
                ))}
            </div>
        </>
    );
};


// --- Main Ticket Component ---

export interface TicketProps extends React.HTMLAttributes<HTMLDivElement> {
    ticketId: string;
    amount: number;
    date: Date;
    staffName: string;
    paymentMethod: string;
    reference?: string;
    barcodeValue: string;
}

const AnimatedTicket = React.forwardRef<HTMLDivElement, TicketProps>(
    (
        {
            className,
            ticketId,
            amount,
            date,
            staffName,
            paymentMethod,
            reference,
            barcodeValue,
            ...props
        },
        ref
    ) => {
        const [showConfetti, setShowConfetti] = React.useState(false);

        React.useEffect(() => {
            const mountTimer = setTimeout(() => setShowConfetti(true), 100);
            const unmountTimer = setTimeout(() => setShowConfetti(false), 6000);
            return () => {
                clearTimeout(mountTimer);
                clearTimeout(unmountTimer);
            };
        }, []);

        const formattedAmount = new Intl.NumberFormat("en-ET", {
            style: "currency",
            currency: "ETB",
        }).format(amount);

        const formattedDate = new Intl.DateTimeFormat("en-GB", {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date).replace(',', ' •');

        return (
            <>
                {showConfetti && <ConfettiExplosion />}
                <div
                    ref={ref}
                    className={cn(
                        "relative w-full max-w-sm bg-card border border-primary/20 text-white rounded-[2.5rem] shadow-2xl font-sans z-10 overflow-hidden",
                        "animate-in fade-in-0 zoom-in-95 duration-700",
                        className
                    )}
                    {...props}
                >
                    {/* Baro Branding Gradient */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-blue-500 opacity-80" />

                    {/* Ticket cut-out effect */}
                    <div className="absolute -left-4 top-[65%] -translate-y-1/2 w-8 h-8 rounded-full bg-background border-r border-primary/10" />
                    <div className="absolute -right-4 top-[65%] -translate-y-1/2 w-8 h-8 rounded-full bg-background border-l border-primary/10" />

                    <div className="p-8 pb-4 flex flex-col items-center text-center">
                        <div className="p-4 bg-primary/10 rounded-[2rem] border border-primary/20 animate-in zoom-in-50 delay-300 duration-1000 relative">
                            <CheckCircle2 className="w-12 h-12 text-primary" />
                            <div className="absolute -inset-1 bg-primary/20 blur-xl rounded-full -z-10 animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-black mt-6 tracking-tighter uppercase">Order Cleared</h1>
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2 px-8">
                            Transaction processed successfully. table is now free.
                        </p>
                    </div>

                    <div className="px-8 pb-8 space-y-6">
                        <DashedLine />

                        <div className="grid grid-cols-2 gap-4 text-left">
                            <div>
                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest ">Ticket ID</p>
                                <p className="font-mono text-xs font-bold text-gray-300">#{ticketId}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Amount Paid</p>
                                <p className="font-black text-xl text-primary font-mono tracking-tighter">{formattedAmount}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Date & Time</p>
                                <p className="font-bold text-xs text-gray-300 mt-1">{formattedDate}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Staff</p>
                                <p className="font-bold text-xs text-gray-300 mt-1 uppercase leading-none">{staffName}</p>
                            </div>
                        </div>

                        <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                                    {paymentMethod === 'cash' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Activity className="w-4 h-4 text-blue-500" />}
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Payment Method</p>
                                    <p className="font-black text-[11px] uppercase text-white">{paymentMethod}</p>
                                </div>
                            </div>
                            {reference && (
                                <Badge variant="outline" className="text-[8px] border-primary/20 text-gray-500 font-mono">
                                    {reference}
                                </Badge>
                            )}
                        </div>

                        <DashedLine />

                        <Barcode value={barcodeValue} />

                        <div className="flex items-center justify-center gap-2 pt-2 opacity-30">
                            <ShieldCheck className="w-3 h-3 text-primary" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Baro Secured Transaction</span>
                        </div>
                    </div>
                </div>
            </>
        );
    }
);

AnimatedTicket.displayName = "AnimatedTicket";

export { AnimatedTicket };
