"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionMasterProvider = exports.useMotionMaster = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * Motion Master: Centralized motion and entrance animation utilities for SDUI widgets
 * Applies cinematic, non-blocking staggered entrance and spring effects
 */
const react_1 = require("react");
const MotionMasterContext = (0, react_1.createContext)({
    register: () => { },
});
const useMotionMaster = () => (0, react_1.useContext)(MotionMasterContext);
exports.useMotionMaster = useMotionMaster;
const MotionMasterProvider = ({ children }) => {
    const refs = (0, react_1.useRef)([]);
    // Staggered entrance effect
    (0, react_1.useEffect)(() => {
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
    return ((0, jsx_runtime_1.jsx)(MotionMasterContext.Provider, { value: { register }, children: children }));
};
exports.MotionMasterProvider = MotionMasterProvider;
//# sourceMappingURL=MotionMaster.js.map