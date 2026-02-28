import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { BaroBackground } from '../components/BaroBackground';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { Button, showToast, cn } from '../components/ui';
import {
    UtensilsCrossed, Package, Truck, ArrowLeft, ArrowRight,
    User, Mail, Phone, Building, MapPin, Hash, Car,
    CheckCircle, Loader2, Sparkles
} from 'lucide-react';

type OnboardingRole = 'owner' | 'supplier' | 'driver';
type Step = 'role' | 'form' | 'success';

interface FormData {
    full_name: string;
    email: string;
    phone: string;
    // Owner
    restaurant_name: string;
    restaurant_type: string;
    city: string;
    branch_count: string;
    // Supplier
    company_name: string;
    supply_category: string;
    cities_covered: string;
    // Driver
    vehicle_type: string;
}

const RESTAURANT_TYPES = ['Cafe', 'Restaurant', 'Fast Food', 'Other'];
const SUPPLY_CATEGORIES = ['Food', 'Beverages', 'Dry Goods', 'Other'];
const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Van'];

const ROLE_CARDS: { role: OnboardingRole; icon: React.ReactNode; title: string; subtitle: string; color: string }[] = [
    {
        role: 'owner',
        icon: <UtensilsCrossed className="w-10 h-10" />,
        title: 'Restaurant Owner',
        subtitle: 'Launch your restaurant on Baro OS',
        color: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 hover:border-amber-400/60',
    },
    {
        role: 'supplier',
        icon: <Package className="w-10 h-10" />,
        title: 'Supplier',
        subtitle: 'Supply restaurants on the platform',
        color: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 hover:border-blue-400/60',
    },
    {
        role: 'driver',
        icon: <Truck className="w-10 h-10" />,
        title: 'Driver',
        subtitle: 'Deliver orders across the network',
        color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400/60',
    },
];

const InputField: React.FC<{
    icon: React.ReactNode;
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
}> = ({ icon, label, name, value, onChange, type = 'text', placeholder, required = true }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
            {icon} {label}
        </label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-2 focus:ring-brand-yellow/20 focus:border-brand-yellow/40 transition-all font-bold placeholder:text-white/15 outline-none"
        />
    </div>
);

const SelectField: React.FC<{
    icon: React.ReactNode;
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
    required?: boolean;
}> = ({ icon, label, name, value, onChange, options, required = true }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
            {icon} {label}
        </label>
        <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-2 focus:ring-brand-yellow/20 focus:border-brand-yellow/40 transition-all font-bold outline-none appearance-none cursor-pointer"
        >
            <option value="" className="bg-[#0a0a0a]">Select...</option>
            {options.map(o => (
                <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>
            ))}
        </select>
    </div>
);

const Onboarding: React.FC = () => {
    const [step, setStep] = useState<Step>('role');
    const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        full_name: '', email: '', phone: '',
        restaurant_name: '', restaurant_type: '', city: '', branch_count: '1',
        company_name: '', supply_category: '', cities_covered: '',
        vehicle_type: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole) return;
        setLoading(true);

        try {
            const insertData: any = {
                role: selectedRole,
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone,
            };

            if (selectedRole === 'owner') {
                insertData.restaurant_name = formData.restaurant_name;
                insertData.restaurant_type = formData.restaurant_type;
                insertData.city = formData.city;
                insertData.branch_count = parseInt(formData.branch_count) || 1;
            } else if (selectedRole === 'supplier') {
                insertData.company_name = formData.company_name;
                insertData.supply_category = formData.supply_category;
                insertData.cities_covered = formData.cities_covered;
            } else if (selectedRole === 'driver') {
                insertData.city = formData.city;
                insertData.vehicle_type = formData.vehicle_type;
            }

            const { error } = await supabase
                .from('onboarding_applications')
                .insert(insertData);

            if (error) throw error;

            setStep('success');
        } catch (err: any) {
            console.error('Onboarding error:', err);
            showToast(err.message || 'Failed to submit application. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaroBackground variant="landing">
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden min-h-screen">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />

                <div className="w-full max-w-2xl relative z-10">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="flex justify-center mb-6">
                            <BaroLogo3D size="sm" animate />
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter italic mb-3 text-white">
                            Join <span className="serif-ital text-brand-green lowercase">Baro</span>
                        </h1>
                        <p className="text-white/40 text-sm font-bold uppercase tracking-widest">
                            Apply for platform access
                        </p>
                    </div>

                    {/* Step 1: Role Selection */}
                    {step === 'role' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {ROLE_CARDS.map(card => (
                                    <button
                                        key={card.role}
                                        onClick={() => {
                                            setSelectedRole(card.role);
                                            setStep('form');
                                        }}
                                        className={cn(
                                            "group relative bg-gradient-to-br border rounded-[2rem] p-8 text-left transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]",
                                            card.color
                                        )}
                                    >
                                        <div className="space-y-4">
                                            <div className="text-white/80 group-hover:text-white transition-colors">
                                                {card.icon}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-white tracking-tight">{card.title}</h3>
                                                <p className="text-white/40 text-xs font-bold mt-1">{card.subtitle}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="absolute top-8 right-8 w-5 h-5 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>

                            <div className="text-center pt-6">
                                <Link
                                    to="/login"
                                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white flex items-center justify-center gap-2 transition-colors group"
                                >
                                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                    Already have an account? Log in
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Form */}
                    {step === 'form' && selectedRole && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-black/60 border border-white/10 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                                <div className="p-8 sm:p-10 border-b border-white/5">
                                    <button
                                        onClick={() => setStep('role')}
                                        className="flex items-center gap-2 text-white/40 text-xs font-black uppercase tracking-widest hover:text-white transition-colors mb-4 group"
                                    >
                                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                        Change Role
                                    </button>
                                    <h2 className="text-2xl font-black text-white tracking-tight">
                                        {selectedRole === 'owner' && '🍽️ Restaurant Owner Application'}
                                        {selectedRole === 'supplier' && '📦 Supplier Application'}
                                        {selectedRole === 'driver' && '🚗 Driver Application'}
                                    </h2>
                                </div>

                                <form onSubmit={handleSubmit} className="p-8 sm:p-10 space-y-6">
                                    {/* Common fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <InputField icon={<User className="w-3.5 h-3.5" />} label="Full Name" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="John Doe" />
                                        <InputField icon={<Mail className="w-3.5 h-3.5" />} label="Email" name="email" value={formData.email} onChange={handleChange} type="email" placeholder="name@example.com" />
                                    </div>
                                    <InputField icon={<Phone className="w-3.5 h-3.5" />} label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} placeholder="+251 9XX XXX XXX" />

                                    {/* Divider */}
                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                                        <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest">
                                            <span className="bg-[#0a0a0a] px-4 text-white/30 italic">Role Details</span>
                                        </div>
                                    </div>

                                    {/* Owner fields */}
                                    {selectedRole === 'owner' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <InputField icon={<Building className="w-3.5 h-3.5" />} label="Restaurant Name" name="restaurant_name" value={formData.restaurant_name} onChange={handleChange} placeholder="e.g. Baro Bistro" />
                                                <SelectField icon={<UtensilsCrossed className="w-3.5 h-3.5" />} label="Restaurant Type" name="restaurant_type" value={formData.restaurant_type} onChange={handleChange} options={RESTAURANT_TYPES} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <InputField icon={<MapPin className="w-3.5 h-3.5" />} label="City" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Addis Ababa" />
                                                <InputField icon={<Hash className="w-3.5 h-3.5" />} label="Number of Branches" name="branch_count" value={formData.branch_count} onChange={handleChange} type="number" placeholder="1" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Supplier fields */}
                                    {selectedRole === 'supplier' && (
                                        <div className="space-y-6">
                                            <InputField icon={<Building className="w-3.5 h-3.5" />} label="Company Name" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="e.g. Fresh Farms Supply" />
                                            <SelectField icon={<Package className="w-3.5 h-3.5" />} label="What do you supply?" name="supply_category" value={formData.supply_category} onChange={handleChange} options={SUPPLY_CATEGORIES} />
                                            <InputField icon={<MapPin className="w-3.5 h-3.5" />} label="Cities You Cover" name="cities_covered" value={formData.cities_covered} onChange={handleChange} placeholder="e.g. Addis Ababa, Hawassa, Dire Dawa" />
                                        </div>
                                    )}

                                    {/* Driver fields */}
                                    {selectedRole === 'driver' && (
                                        <div className="space-y-6">
                                            <InputField icon={<MapPin className="w-3.5 h-3.5" />} label="City" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Addis Ababa" />
                                            <SelectField icon={<Car className="w-3.5 h-3.5" />} label="Vehicle Type" name="vehicle_type" value={formData.vehicle_type} onChange={handleChange} options={VEHICLE_TYPES} />
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-xs h-16 rounded-2xl mt-6 shadow-2xl shadow-brand-yellow/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                                        ) : (
                                            <><Sparkles className="w-5 h-5" /> Submit Application</>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 'success' && (
                        <div className="animate-in fade-in zoom-in-95 duration-700 text-center space-y-8">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-brand-green/20 blur-[80px] rounded-full" />
                                <div className="relative p-8 bg-brand-green/10 rounded-[2rem] border border-brand-green/20">
                                    <CheckCircle className="w-20 h-20 text-brand-green" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-3xl font-black text-white tracking-tight">Application Received!</h2>
                                <p className="text-white/50 text-sm font-medium max-w-md mx-auto">
                                    Thank you for applying. We'll review your application and contact you soon with next steps.
                                </p>
                            </div>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </Link>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-12 text-center px-8 opacity-20">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white leading-relaxed">
                            Baro Restaurant OS — All applications are reviewed within 24-48 hours.
                        </p>
                    </div>
                </div>
            </div>
        </BaroBackground>
    );
};

export default Onboarding;
