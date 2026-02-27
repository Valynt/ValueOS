"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sduiTelemetry = exports.SDUITelemetry = exports.TelemetryEventType = void 0;
var TelemetryEventType;
(function (TelemetryEventType) {
    TelemetryEventType["COMPONENT_ERROR"] = "component_error";
    TelemetryEventType["COMPONENT_MOUNT"] = "component_mount";
    TelemetryEventType["COMPONENT_RESOLVE"] = "component_resolve";
    TelemetryEventType["HYDRATION_CACHE_HIT"] = "hydration_cache_hit";
    TelemetryEventType["CIRCUIT_BREAKER_EVENT"] = "circuit_breaker_event";
})(TelemetryEventType || (exports.TelemetryEventType = TelemetryEventType = {}));
class SDUITelemetry {
    track(event) {
        // no-op in library; consumers can override
    }
    recordEvent(event) {
        this.track(event);
    }
}
exports.SDUITelemetry = SDUITelemetry;
exports.sduiTelemetry = new SDUITelemetry();
//# sourceMappingURL=SDUITelemetry.js.map