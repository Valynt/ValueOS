"""
LLM integration for entity extraction and insight generation.
Uses OpenAI gpt-4o-mini for speed and cost efficiency.
"""

import json
from typing import Any, Optional, TypeVar
from pydantic import BaseModel
from openai import AsyncOpenAI


T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """Async LLM client for extraction and analysis."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
    
    async def extract_structured(
        self,
        prompt: str,
        response_model: type[T],
        system_prompt: Optional[str] = None,
    ) -> T:
        """
        Extract structured data from text using the LLM.
        
        Args:
            prompt: The extraction prompt with context
            response_model: Pydantic model for the response
            system_prompt: Optional system prompt
            
        Returns:
            Parsed response matching the Pydantic model
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.1,  # Low temperature for extraction
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        return response_model.model_validate(data)
    
    async def extract_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Extract JSON data from text.
        
        Args:
            prompt: The extraction prompt
            system_prompt: Optional system prompt
            
        Returns:
            Parsed JSON dict
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
    
    async def analyze(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """
        General analysis/generation.
        
        Args:
            prompt: The analysis prompt
            system_prompt: Optional system prompt
            temperature: Creativity level
            
        Returns:
            Generated text response
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )
        
        return response.choices[0].message.content


# Extraction prompt templates
ENTITY_EXTRACTION_PROMPT = """
Analyze the following web page content and extract entities.

URL: {url}
Content:
{content}

Extract the following entity types:
- Organizations (companies, startups)
- Products (software, services)
- Features (capabilities, functionalities)
- Technologies (frameworks, languages, tools)
- People (founders, executives)
- Integrations (third-party connections)

Return JSON with structure:
{{
    "entities": [
        {{
            "type": "organization|product|feature|technology|person|integration",
            "name": "Entity name",
            "description": "Brief description",
            "confidence": 0.0-1.0
        }}
    ],
    "relationships": [
        {{
            "source": "Source entity name",
            "target": "Target entity name",
            "type": "owns|has_feature|uses_technology|integrates_with|employs",
            "evidence": "Text evidence"
        }}
    ]
}}
"""

COMPETITOR_DISCOVERY_PROMPT = """
Based on the following company information, identify potential competitors.

Company: {company_name}
Description: {description}
Products: {products}
Industry signals: {industry}

Identify 5 likely competitors. Return JSON:
{{
    "competitors": [
        {{
            "name": "Competitor name",
            "reasoning": "Why they compete",
            "confidence": 0.0-1.0
        }}
    ]
}}
"""

INSIGHT_GENERATION_PROMPT = """
Analyze this company's ontology and generate actionable insights.

Company: {company_name}
Entity Summary: {entity_summary}
Competitive Landscape: {competitors}
Technology Stack: {tech_stack}

Generate insights about:
- Competitive gaps
- Market opportunities
- Technology risks
- Strategic recommendations

Return JSON:
{{
    "insights": [
        {{
            "type": "gap|opportunity|risk|competitive|trend",
            "severity": "low|medium|high|critical",
            "title": "Insight title",
            "description": "Detailed description",
            "recommendation": "What to do about it",
            "confidence": 0.0-1.0
        }}
    ]
}}
"""
