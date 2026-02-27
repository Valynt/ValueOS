"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanCheckpoint = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const RedisStreamBroker_1 = require("../../../app/src/services/messaging/RedisStreamBroker");
const AuthProvider_1 = require("../../../app/src/app/providers/AuthProvider");
const uuid_1 = require("uuid");
const HumanCheckpoint = ({ sessionId, tenantId, onApproval, onPause, onResume, }) => {
    const [pendingActions, setPendingActions] = (0, react_1.useState)([]);
    const [isPaused, setIsPaused] = (0, react_1.useState)(false);
    const [broker, setBroker] = (0, react_1.useState)(null);
    const { user } = (0, AuthProvider_1.useAuth)();
    (0, react_1.useEffect)(() => {
        const initializeBroker = async () => {
            const streamBroker = new RedisStreamBroker_1.RedisStreamBroker({
                streamName: "agent.checkpoints",
                consumerName: `checkpoint-${user?.id || "anonymous"}-${sessionId}`,
            });
            await streamBroker.initialize();
            setBroker(streamBroker);
            // Listen for checkpoint events
            streamBroker.startConsumer(async (event) => {
                if (event.name === "agent.action.checkpoint") {
                    const payload = event.payload;
                    if (payload.sessionId === sessionId &&
                        payload.tenantId === tenantId &&
                        payload.requiresApproval) {
                        const checkpointAction = {
                            id: payload.idempotencyKey,
                            actionType: payload.actionType,
                            actionData: payload.actionData,
                            requiresApproval: payload.requiresApproval,
                            reason: payload.reason,
                            timestamp: payload.emittedAt,
                        };
                        setPendingActions((prev) => [...prev, checkpointAction]);
                        setIsPaused(true);
                        onPause();
                    }
                }
            });
        };
        initializeBroker();
        return () => {
            // Cleanup
        };
    }, [sessionId, tenantId, user?.id, onPause]);
    const handleApproval = async (actionId, approved, reason) => {
        if (!broker)
            return;
        // Remove from pending actions
        setPendingActions((prev) => prev.filter((action) => action.id !== actionId));
        // Publish approval decision
        await broker.publish("agent.action.checkpoint", {
            schemaVersion: "1.0.0",
            idempotencyKey: (0, uuid_1.v4)(),
            emittedAt: new Date().toISOString(),
            tenantId,
            sessionId,
            userId: user?.id || "anonymous",
            actionType: "approval_response",
            actionData: { actionId, approved, reason },
            requiresApproval: false,
            reason: approved
                ? "Action approved by user"
                : `Action rejected: ${reason || "No reason provided"}`,
        });
        onApproval(approved, reason);
        // If no more pending actions, resume
        if (pendingActions.length <= 1) {
            setIsPaused(false);
            onResume();
        }
    };
    if (pendingActions.length === 0) {
        return null;
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "human-checkpoint-overlay", children: (0, jsx_runtime_1.jsxs)("div", { className: "checkpoint-modal", children: [(0, jsx_runtime_1.jsx)("h3", { children: "Agent Action Requires Approval" }), pendingActions.map((action) => ((0, jsx_runtime_1.jsxs)("div", { className: "checkpoint-action", children: [(0, jsx_runtime_1.jsxs)("div", { className: "action-details", children: [(0, jsx_runtime_1.jsx)("strong", { children: action.actionType }), (0, jsx_runtime_1.jsx)("p", { children: action.reason }), (0, jsx_runtime_1.jsx)("pre", { children: JSON.stringify(action.actionData, null, 2) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "action-controls", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => handleApproval(action.id, true), className: "approve-btn", children: "Approve" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                        const reason = prompt("Reason for rejection:");
                                        handleApproval(action.id, false, reason || undefined);
                                    }, className: "reject-btn", children: "Reject" })] })] }, action.id))), isPaused && ((0, jsx_runtime_1.jsx)("div", { className: "pause-indicator", children: "Agent execution is paused pending your approval." }))] }) }));
};
exports.HumanCheckpoint = HumanCheckpoint;
//# sourceMappingURL=HumanCheckpoint.js.map