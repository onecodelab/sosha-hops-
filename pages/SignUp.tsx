import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, showToast } from '../components/ui';
import { SoshaLogo } from '../components/SoshaLogo';
import { Loader2, ArrowLeft } from 'lucide-react';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Check if user was invited
      const { data: invitation, error: inviteError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('invitation_pending', true)
        .single();

      if (inviteError || !invitation) {
        throw new Error('No pending invitation found for this email. Please contact your manager.');
      }

      // 2. Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: invitation.full_name,
            role: invitation.role
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // 3. Update the user profile with the auth ID
        // Note: The database trigger 'handle_new_user' is designed to handle this automatically.
        // We attempt this manual update as a fallback/confirmation step as requested.
        const { error: updateError } = await supabase
          .from('users')
          .update({
            id: authData.user.id,
            invitation_pending: false
          })
          .eq('email', email);

        // We log but don't block on updateError because RLS might prevent non-owners from updating.
        // If the trigger ran successfully, the ID is already updated anyway.
        if (updateError) {
           console.warn("Manual profile link update info:", updateError);
        }

        showToast('Account created! Please log in.', 'success');
        
        // Redirect to the appropriate role login
        setTimeout(() => {
          navigate(`/login/${invitation.role}`);
        }, 1500);
      }

    } catch (error: any) {
      console.error("Signup error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1A1A1A] border-gray-800">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-20 h-20 mb-4 flex items-center justify-center">
              <SoshaLogo className="w-full h-full" />
          </div>
          <CardTitle className="text-2xl text-center text-white">
            Staff Sign Up
          </CardTitle>
          <p className="text-center text-gray-400 text-sm">
            Enter your email to claim your invitation
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email Address</label>
              <Input 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-black/20 border-gray-700 text-white placeholder:text-gray-600 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Create Password</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="bg-black/20 border-gray-700 text-white focus:border-primary"
              />
            </div>
            
            <Button type="submit" className="w-full font-bold text-black" isLoading={loading} disabled={loading}>
              {loading ? 'Creating Account...' : 'Complete Sign Up'}
            </Button>
            
            <div className="pt-4 border-t border-gray-800 text-center">
                <Link to="/" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;