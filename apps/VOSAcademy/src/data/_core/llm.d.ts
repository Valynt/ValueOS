export declare function invokeLLM(options: {
    messages: Array<{
        role: string;
        content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
}): Promise<{
    choices: {
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}>;
