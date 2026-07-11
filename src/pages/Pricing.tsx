import React, { useState } from 'react';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import {
    Mail,
    Phone,
    MapPin,
    ArrowRight,
    CheckCircle2,
    Sparkles,
} from 'lucide-react';

const BookDemoPage: React.FC = () => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Demo Inquiry - ${name}`);
        const body = encodeURIComponent(
            `Full Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nRestaurant Details:\n${message}`
        );
        window.open(`mailto:flow@baroos.com?subject=${subject}&body=${body}`);
        setSubmitted(true);
    };

    return (
        <MarketingLayout>
            <div className="bg-[#faf9f7] text-[#0c0d0e] py-16 md:py-24">
                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

                    {/* LEFT COLUMN: INVITATION & DIRECT CONTACT */}
                    <div className="lg:col-span-6 space-y-8">
                        <div>
                            <span className="font-mono text-xs font-bold uppercase tracking-widest bg-[#84e7a5] text-[#02492a] px-3 py-1.5 rounded-full inline-block mb-4">
                                {t('bookDemo.tag') || 'BOOK A FREE DEMO'}
                            </span>

                            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#0c0d0e] leading-[1.1] mb-6">
                                {t('bookDemo.title1') || 'Ready to Modernize'}{' '}
                                <span className="text-[#078a52] block sm:inline">
                                    {t('bookDemo.title2') || 'Your Restaurant?'}
                                </span>
                            </h1>

                            <p className="text-base sm:text-lg text-[#55534e] max-w-xl leading-relaxed font-normal">
                                {t('bookDemo.desc') || 'Schedule a free demo. We configure your menu, tables, and staff, and get your restaurant running smoothly within 2 weeks.'}
                            </p>
                        </div>

                        {/* Early Access Clay Craft Card */}
                        <div className="clay-card p-6 bg-white max-w-lg">
                            <div className="flex items-start gap-3.5">
                                <CheckCircle2 className="w-6 h-6 text-[#078a52] shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-base font-bold text-[#0c0d0e]">
                                        {t('bookDemo.earlyAccess') || 'Early Access Open'}
                                    </h4>
                                    <p className="text-sm text-[#55534e] mt-1 leading-relaxed">
                                        Be among the forward-thinking Ethiopian restaurants running with zero paper tickets and full Telebirr receipt verification.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Direct Contact Details */}
                        <div className="space-y-4 pt-6 border-t border-[#dad4c8]">
                            <p className="font-mono text-xs font-bold text-[#717989] uppercase tracking-wider">
                                {t('bookDemo.talkDirectly') || 'OR CONTACT OUR TEAM DIRECTLY:'}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-sm text-[#0c0d0e] font-medium">
                                <div className="flex items-center gap-2.5">
                                    <MapPin className="w-4 h-4 text-[#078a52]" />
                                    <span>{t('bookDemo.location') || 'Addis Ababa, Ethiopia'}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Mail className="w-4 h-4 text-[#078a52]" />
                                    <span>flow@baroos.com</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Phone className="w-4 h-4 text-[#078a52]" />
                                    <span>{t('bookDemo.phone') || '+251 988 2026'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: BOOKING FORM WITH CLAY HARD OFFSET SHADOW */}
                    <div className="lg:col-span-6 w-full">
                        <div className="bg-white border-2 border-[#0c0d0e] rounded-[32px] p-8 sm:p-12 shadow-[-8px_8px_0px_#0c0d0e]">
                            {submitted ? (
                                <div className="text-center py-16 space-y-6">
                                    <div className="w-16 h-16 bg-[#84e7a5] text-[#02492a] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-[#0c0d0e]">
                                        {t('bookDemo.successTitle') || 'Request Received!'}
                                    </h2>
                                    <p className="text-sm text-[#55534e] max-w-sm mx-auto leading-relaxed">
                                        {t('bookDemo.successDesc') || 'Thank you! We received your demo request and our team will contact you within 24 hours to arrange your session.'}
                                    </p>
                                    <button
                                        onClick={() => setSubmitted(false)}
                                        className="clay-btn-outline text-sm"
                                    >
                                        <span>{t('bookDemo.restartButton') || 'Send Another Message'}</span>
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="pb-4 border-b border-[#dad4c8]">
                                        <h3 className="text-2xl font-bold text-[#0c0d0e]">
                                            {t('bookDemo.formTitle') || 'Schedule Your Free Demo'}
                                        </h3>
                                        <p className="text-xs font-mono text-[#55534e] mt-1">
                                            WE SETUP EVERYTHING • 2 WEEKS ONBOARDING
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs font-bold text-[#0c0d0e] uppercase tracking-wider block">
                                            {t('bookDemo.nameLabel') || 'Full Name'} <span className="text-[#078a52]">*</span>
                                        </label>
                                        <input
                                            placeholder={t('bookDemo.namePlaceholder') || 'Enter your name...'}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full bg-[#faf9f7] border border-[#dad4c8] rounded-xl h-12 px-4 text-[#0c0d0e] text-sm focus:outline-none focus:border-[#0c0d0e]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs font-bold text-[#0c0d0e] uppercase tracking-wider block">
                                            {t('bookDemo.phoneLabel') || 'Phone Number'} <span className="text-[#078a52]">*</span>
                                        </label>
                                        <input
                                            placeholder={t('bookDemo.phonePlaceholder') || '+251 9...'}
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            required
                                            className="w-full bg-[#faf9f7] border border-[#dad4c8] rounded-xl h-12 px-4 text-[#0c0d0e] text-sm focus:outline-none focus:border-[#0c0d0e]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs font-bold text-[#0c0d0e] uppercase tracking-wider block">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="you@restaurant.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-[#faf9f7] border border-[#dad4c8] rounded-xl h-12 px-4 text-[#0c0d0e] text-sm focus:outline-none focus:border-[#0c0d0e]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs font-bold text-[#0c0d0e] uppercase tracking-wider block">
                                            {t('bookDemo.messageLabel') || 'Tell Us About Your Restaurant'}
                                        </label>
                                        <textarea
                                            placeholder={t('bookDemo.messagePlaceholder') || 'Restaurant name, location, number of tables...'}
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            rows={4}
                                            className="w-full bg-[#faf9f7] border border-[#dad4c8] rounded-xl p-4 text-[#0c0d0e] text-sm focus:outline-none focus:border-[#0c0d0e]"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="clay-btn-primary w-full py-4 text-base"
                                    >
                                        <span>{t('bookDemo.submitButton') || 'Send Request'}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </MarketingLayout>
    );
};

export default BookDemoPage;
