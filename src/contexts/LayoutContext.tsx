import React, { createContext, useContext, useState, useRef, ReactNode, useEffect, useCallback, useMemo } from 'react';

interface LayoutConfig {
    title?: string;
    subtitle?: string | ReactNode;
    actions?: ReactNode;
    className?: string;
    isSidebarCollapsed?: boolean;
    onSidebarCollapseChange?: (collapsed: boolean) => void;
    fullScreen?: boolean;
}

interface LayoutContextType {
    config: LayoutConfig;
    setConfig: (config: LayoutConfig) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<LayoutConfig>({
        title: '',
        subtitle: ''
    });

    // Memoize the context value so it only changes when config changes
    const contextValue = useMemo(() => ({ config, setConfig }), [config]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayoutConfig = (config: LayoutConfig) => {
    const context = useContext(LayoutContext);
    if (!context) throw new Error('useLayoutConfig must be used within a LayoutProvider');

    // Use refs to break the circular dependency:
    // Reading context (subscribes to changes) + setting context (triggers re-render)
    // = infinite loop. Refs avoid this by not triggering re-renders.
    const setConfigRef = useRef(context.setConfig);
    setConfigRef.current = context.setConfig;

    const configRef = useRef(config);
    configRef.current = config;

    // Create a stable primitive key from config values for dependency tracking.
    // Only primitive string changes will cause the effect to re-run.
    const configKey = `${config.title || ''}::${typeof config.subtitle === 'string' ? config.subtitle : ''}::${config.className || ''}::${config.fullScreen ?? ''}`;

    useEffect(() => {
        setConfigRef.current(configRef.current);
    }, [configKey]);
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) throw new Error('useLayout must be used within a LayoutProvider');
    return context;
};
