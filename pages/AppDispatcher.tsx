import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

const AppDispatcher: React.FC = () => {
    const { profile, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && profile) {
            const role = profile.role.toLowerCase();
            if (role === 'owner') navigate('/app/owner');
            else if (role === 'admin') navigate('/app/admin');
            else if (role === 'manager') navigate('/app/manager');
            else if (role === 'waiter') navigate('/app/waiter');
            else if (role === 'kitchen') navigate('/app/kitchen');
            else navigate('/');
        }
    }, [profile, loading, navigate]);

    return <LoadingSpinner />;
};

export default AppDispatcher;
