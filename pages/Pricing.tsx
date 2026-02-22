import React, { useState } from 'react';
import { MarketingLayout } from '../components/MarketingLayout';
import { Button, Input, Card, CardContent } from '../components/ui';
import {
    Mail,
    Phone,
    MapPin,
    ArrowRight,
    Send,
} from 'lucide-react';

const BookDemoPage: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Demo Inquiry - ${name}`);
        const body = encodeURIComponent(
            `Full Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`
        );
        window.open(`mailto:hello@baroos.com?subject=${subject}&body=${body}`);
        setSubmitted(true);
    };

    return (
        <MarketingLayout>
            <div className="min-h-screen bg-black relative overflow-hidden flex flex-col justify-center py-24 liquid-bg">
                {/* Background Atmosphere */}
                <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-brand-yellow/5 blur-[150px] rounded-full pointer-events-none animate-pulse-slow" />

                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10 w-full mt-10">

                    {/* LEFT COLUMN: NARRATIVE */}
                    <div className="space-y-12 animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="space-y-8">
                            <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white leading-[0.8]">
                                Ready to <br /> put <br />
                                <span className="serif-ital text-brand-green lowercase">the Flow</span> <br />
                                to work?
                            </h1>
                            <p className="serif-ital text-2xl md:text-3xl text-white/70 max-w-xl leading-relaxed">
                                We are happy to think about smart steps with AI, from idea to first
                                working agent within 2 weeks.
                            </p>

                            <Button
                                size="lg"
                                className="px-12 h-20 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-full shadow-2xl shadow-brand-yellow/20 group transition-all ripple-link"
                            >
                                Schedule an introductory meeting
                                <ArrowRight className="w-5 h-5 ml-6 group-hover:translate-x-3 transition-transform" />
                            </Button>
                        </div>

                        <div className="space-y-8 pt-12 border-t border-white/10">
                            <p className="mono-os text-[10px] font-black text-white/30 tracking-[0.5em] uppercase">Or talk directly to our advisor</p>
                            <div className="flex flex-wrap gap-10 text-white/50">
                                <div className="flex items-center gap-4 group cursor-pointer hover:text-white transition-colors">
                                    <MapPin className="w-4 h-4 text-brand-green group-hover:scale-125 transition-transform" />
                                    <span className="mono-os text-[10px] font-black tracking-widest">Baro River Basin, GM</span>
                                </div>
                                <div className="flex items-center gap-4 group cursor-pointer hover:text-white transition-colors">
                                    <Mail className="w-4 h-4 text-brand-green group-hover:scale-125 transition-transform" />
                                    <span className="mono-os text-[10px] font-black tracking-widest">flow@baroos.com</span>
                                </div>
                                <div className="flex items-center gap-4 group cursor-pointer hover:text-white transition-colors">
                                    <Phone className="w-4 h-4 text-brand-green group-hover:scale-125 transition-transform" />
                                    <span className="mono-os text-[10px] font-black tracking-widest">+251 988 2026</span>
                                </div>
                            </div>
                        </div>

                        {/* Trusted By Cluster */}
                        <div className="space-y-8">
                            <p className="mono-os text-[9px] font-black text-white/20 tracking-[0.3em] uppercase">Trusted By</p>
                            <div className="flex flex-wrap items-center gap-x-14 gap-y-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-1000 group/logos">
                                {['Pulse', 'NileFlow', 'DeltaOps', 'SourceAI'].map(logo => (
                                    <span key={logo} className="text-2xl font-black tracking-tighter text-white uppercase italic hover:text-brand-yellow transition-colors cursor-default">{logo}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: FORM CARD */}
                    <div className="w-full animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                        <Card className="bg-black/40 backdrop-blur-3xl border border-white/5 rounded-[3.5rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            <CardContent className="p-12 md:p-16 relative z-10">
                                {submitted ? (
                                    <div className="text-center py-24 space-y-8">
                                        <div className="w-24 h-24 bg-brand-green/10 border border-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-10 animate-pulse">
                                            <Send className="w-10 h-10 text-brand-green" />
                                        </div>
                                        <h2 className="text-5xl font-black uppercase tracking-tighter text-white font-serif italic">Inquiry Received</h2>
                                        <p className="mono-os text-xs text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">Protocol connection established. An analyst will verify your parameters within 24 hours.</p>
                                        <Button
                                            variant="outline"
                                            onClick={() => setSubmitted(false)}
                                            className="mt-10 border-white/10 hover:border-brand-yellow text-[10px] font-black uppercase tracking-widest px-10 h-14 rounded-2xl ripple-link text-white"
                                        >
                                            Restart Channel
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-10">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">
                                                Your full name <span className="text-brand-green">*</span>
                                            </label>
                                            <Input
                                                placeholder="Enter identifier..."
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                                className="bg-white/5 border-white/10 rounded-2xl h-16 px-8 focus:ring-brand-yellow/20 font-bold text-white placeholder:opacity-20 transition-all focus:bg-white/[0.08]"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">
                                                Phone number
                                            </label>
                                            <Input
                                                placeholder="+xxx xxx xxxx"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-2xl h-16 px-8 focus:ring-brand-yellow/20 font-bold text-white placeholder:opacity-20 transition-all focus:bg-white/[0.08]"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">
                                                Message <span className="text-brand-green">*</span>
                                            </label>
                                            <textarea
                                                placeholder="Tell us about the project scope..."
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                required
                                                rows={5}
                                                className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 font-bold resize-none placeholder:opacity-20 transition-all focus:bg-white/[0.08]"
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-20 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-[0.4em] text-[10px] rounded-3xl shadow-3xl shadow-brand-yellow/10 flex items-center justify-center gap-5 group transition-all ripple-link"
                                        >
                                            <Send className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                                            Send message
                                        </Button>
                                    </form>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Final Atmospheric Exit */}
            <div className="h-48 bg-gradient-to-t from-black to-transparent relative z-0" />
        </MarketingLayout>
    );
};

export default BookDemoPage;
