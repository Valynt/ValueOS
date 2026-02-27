import { jsx as _jsx } from "react/jsx-runtime";
/*
 * Motion Master: Centralized motion and entrance animation utilities for SDUI widgets
 * Applies cinematic, non-blocking staggered entrance and spring effects
 */
import { createContext, useContext, useRef, useEffect } from "react";
const MotionMasterContext = createContext({
    register: () => { },
});
export const useMotionMaster = () => useContext(MotionMasterContext);
export const MotionMasterProvider = ({ children }) => {
    const refs = useRef([]);
    // Staggered entrance effect
    useEffect(() => {
        refs.current.forEach((ref, i) => {
            if (ref.current) {
                ref.current.style.opacity = "0";
                ref.current.style.transform = "translateY(24px)";
                setTimeout(() => {
                    ref.current.style.transition =
                        "opacity 0.4s var(--motion-ease-standard), transform 0.4s var(--motion-ease-standard)";
                    ref.current.style.opacity = "1";
                    ref.current.style.transform = "translateY(0)";
                }, 80 * i);
            }
        });
    }, [children]);
    const register = (ref) => {
        refs.current.push(ref);
    };
    return (_jsx(MotionMasterContext.Provider, { value: { register }, children: children }));
};
//# sourceMappingURL=MotionMaster.js.map