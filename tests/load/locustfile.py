"""
Task #035-037: Load Testing Framework

Load tests for ValueCanvas using Locust
"""

from locust import HttpUser, task, between, events
import json
import random
import time

class ValueCanvasUser(HttpUser):
    """Simulates a user interacting with ValueCanvas"""
    
    wait_time = between(2, 5)  # Wait 2-5 seconds between tasks
    
    def on_start(self):
        """Login and setup user session"""
        # Authenticate
        response = self.client.post("/api/auth/login", json={
            "email": f"loadtest+{random.randint(1, 100)}@valuecanvas.app",
            "password": "loadtest123"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("access_token")
            self.user_id = data.get("user_id")
        else:
            self.auth_token = None
            self.user_id = None
    
    def headers(self):
        """Get auth headers"""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    @task(10)
    def list_value_cases(self):
        """List user's value cases"""
        self.client.get("/api/value-cases", headers=self.headers(), name="/api/value-cases [LIST]")
    
    @task(5)
    def create_value_case(self):
        """Create a new value case"""
        payload = {
            "name": f"Test Case {random.randint(1000, 9999)}",
            "company": f"Company {random.randint(1, 100)}",
            "website": f"https://company{random.randint(1, 100)}.com",
            "stage": random.choice(["opportunity", "target", "realization", "expansion"]),
            "status": "in-progress"
        }
        
        response = self.client.post(
            "/api/value-cases",
            json=payload,
            headers=self.headers(),
            name="/api/value-cases [CREATE]"
        )
        
        if response.status_code == 201:
            case_data = response.json()
            return case_data.get("id")
        return None
    
    @task(8)
    def agent_chat(self):
        """Send chat request to agent"""
        queries = [
            "Analyze cost reduction opportunities for this company",
            "What are the key stakeholders for this initiative?",
            "Calculate the ROI for this project",
            "Identify risk mitigation strategies",
            "Generate a value realization plan"
        ]
        
        payload = {
            "query": random.choice(queries),
            "case_id": f"case-{random.randint(1, 100)}",
            "context": {
                "stage": random.choice(["opportunity", "target"])
            }
        }
        
        # Use streaming endpoint
        with self.client.post(
            "/api/agent/chat",
            json=payload,
            headers=self.headers(),
            catch_response=True,
            name="/api/agent/chat [STREAM]"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Chat failed: {response.status_code}")
    
    @task(3)
    def render_sdui_page(self):
        """Request SDUI page rendering"""
        case_id = f"case-{random.randint(1, 100)}"
        
        self.client.get(
            f"/api/sdui/page/{case_id}",
            headers=self.headers(),
            name="/api/sdui/page/:id [GET]"
        )
    
    @task(2)
    def get_value_metrics(self):
        """Retrieve value metrics summary"""
        self.client.get(
            "/api/metrics/summary",
            headers=self.headers(),
            name="/api/metrics/summary [GET]"
        )
    
    @task(1)
    def search_prompt_templates(self):
        """Search prompt template library"""
        search_terms = ["cost", "revenue", "risk", "automation", "cx"]
        
        self.client.get(
            f"/api/templates?q={random.choice(search_terms)}",
            headers=self.headers(),
            name="/api/templates [SEARCH]"
        )


class AgentStressTest(HttpUser):
    """Heavy stress test focusing on agent processing"""
    
    wait_time = between(0.5, 1.5)
    
    def on_start(self):
        response = self.client.post("/api/auth/login", json={
            "email": f"stress+{random.randint(1, 50)}@valuecanvas.app",
            "password": "stress123"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("access_token")
        else:
            self.auth_token = None
    
    def headers(self):
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    @task
    def concurrent_agent_requests(self):
        """Simulate multiple concurrent agent calls"""
        payload = {
            "query": f"Analyze opportunity {random.randint(1, 1000)}",
            "case_id": f"case-{random.randint(1, 50)}"
        }
        
        start_time = time.time()
        
        with self.client.post(
            "/api/agent/chat",
            json=payload,
            headers=self.headers(),
            catch_response=True,
            name="/api/agent/chat [CONCURRENT]"
        ) as response:
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                if elapsed > 10:
                    response.failure(f"Response too slow: {elapsed:.2f}s")
                else:
                    response.success()
            else:
                response.failure(f"Failed: {response.status_code}")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Test initialization"""
    print("=== ValueCanvas Load Test Starting ===")
    print(f"Target: {environment.host}")
    print(f"Users: {environment.runner.target_user_count}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Test completion and reporting"""
    print("\n=== ValueCanvas Load Test Complete ===")
    
    stats = environment.stats
    
    print(f"\nRequests: {stats.num_requests}")
    print(f"Failures: {stats.num_failures}")
    print(f"Failure Rate: {(stats.num_failures / stats.num_requests * 100) if stats.num_requests > 0 else 0:.2f}%")
    
    print(f"\nResponse Times:")
    print(f"  Median: {stats.total.get_response_time_percentile(0.5):.0f}ms")
    print(f"  95th: {stats.total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  99th: {stats.total.get_response_time_percentile(0.99):.0f}ms")
    
    print(f"\nRequests/sec: {stats.total.total_rps:.2f}")
