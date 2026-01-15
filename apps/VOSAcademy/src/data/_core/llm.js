var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// Mock LLM implementation - in real app this would call OpenAI/Anthropic API
export function invokeLLM(options) {
    return __awaiter(this, void 0, void 0, function () {
        var messages, _a, temperature, lastMessage, content, response;
        return __generator(this, function (_b) {
            messages = options.messages, _a = options.temperature, temperature = _a === void 0 ? 0.7 : _a;
            lastMessage = messages[messages.length - 1];
            content = (lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.content) || "";
            response = "I understand your question. Let me provide a helpful response.";
            if (content.toLowerCase().includes("pillar")) {
                response = "Pillars in VOS represent the core competencies needed for value-driven selling. Each pillar builds upon the previous one, creating a comprehensive framework for enterprise value management.";
            }
            else if (content.toLowerCase().includes("roi")) {
                response = "ROI in VOS is calculated by quantifying the value delivered through Outcomes, measuring against baseline KPIs, and calculating the financial impact over time. A strong ROI model includes benefits, costs, and timeframe.";
            }
            else if (content.toLowerCase().includes("certification")) {
                response = "VOS certifications are earned by passing pillar assessments with an 80% threshold. Bronze certifications are awarded for passing individual pillars, while Silver and Gold tiers require simulation mastery.";
            }
            return [2 /*return*/, {
                    choices: [{
                            message: {
                                content: response,
                                role: "assistant"
                            },
                            finish_reason: "stop"
                        }],
                    usage: {
                        prompt_tokens: 100,
                        completion_tokens: 50,
                        total_tokens: 150
                    }
                }];
        });
    });
}
