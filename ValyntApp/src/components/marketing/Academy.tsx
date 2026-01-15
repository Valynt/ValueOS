import { BookOpen, Trophy, Award, CheckCircle2, Target, Globe } from 'lucide-react';

export function Academy() {
  return (
    <div className="min-h-screen">
      <section className="relative py-32 px-6 overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="absolute inset-0 bg-grid opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8" style={{
            borderColor: 'rgba(0, 255, 157, 0.3)',
            backgroundColor: 'rgba(0, 255, 157, 0.1)',
            border: '1px solid'
          }}>
            <span className="flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#00FF9D' }}></span>
            <span className="text-xs font-mono" style={{ color: '#00FF9D' }}>VOS Academy</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
            Master the Value<br />Operating System
          </h1>

          <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#707070' }}>
            Transform from feature-focused operations to quantifiable value outcomes through our comprehensive 10-week training program
          </p>

          <button className="h-12 px-8 rounded-full text-sm font-semibold transition-all" style={{
            backgroundColor: '#00FF9D',
            color: '#0A0A0A'
          }}>
            Start Your Journey
          </button>
        </div>
      </section>

      <section className="py-24 px-6" style={{ backgroundColor: '#1E1E1E' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why VOS Academy?</h2>
            <p className="max-w-3xl mx-auto" style={{ color: '#707070' }}>
              A comprehensive training system designed to transform your value delivery capability and establish your organization as a leader in value engineering
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 174, 239, 0.15)',
                border: '1px solid rgba(0, 174, 239, 0.3)'
              }}>
                <BookOpen className="w-6 h-6" style={{ color: '#00AEEF' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">10 Comprehensive Weeks</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Structured curriculum covering every aspect of value engineering from foundational concepts to advanced implementation
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 255, 157, 0.15)',
                border: '1px solid rgba(0, 255, 157, 0.3)'
              }}>
                <Target className="w-6 h-6" style={{ color: '#00FF9D' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Industry-Aligned Program</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Content validated by leading value engineers and CFOs, ensuring real-world applicability and immediate business impact
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 174, 239, 0.15)',
                border: '1px solid rgba(0, 174, 239, 0.3)'
              }}>
                <Trophy className="w-6 h-6" style={{ color: '#00AEEF' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Role-Specific Tracks</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Tailored learning paths for Sales, Customer Success, Product Marketing, and Leadership ensuring relevance for all roles
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 255, 157, 0.15)',
                border: '1px solid rgba(0, 255, 157, 0.3)'
              }}>
                <Award className="w-6 h-6" style={{ color: '#00FF9D' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Certification System</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Earn recognized credentials at Bronze, Silver, Gold, and Platinum levels, validating your VOS expertise to stakeholders
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 174, 239, 0.15)',
                border: '1px solid rgba(0, 174, 239, 0.3)'
              }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: '#00AEEF' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Actionable Tools</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Access templates, frameworks, and battle-tested methodologies you can implement immediately in your organization
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{
                backgroundColor: 'rgba(0, 255, 157, 0.15)',
                border: '1px solid rgba(0, 255, 157, 0.3)'
              }}>
                <Globe className="w-6 h-6" style={{ color: '#00FF9D' }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Practical Application</h3>
              <p className="text-sm" style={{ color: '#707070' }}>
                Real-world projects and case studies ensuring you can apply VOS principles effectively in your daily workflows
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">VOS Maturity Model</h2>
            <p className="max-w-3xl mx-auto" style={{ color: '#707070' }}>
              Progress through five distinct stages of value engineering maturity, from initial awareness to industry-leading mastery
            </p>
          </div>

          <div className="glass-card p-8 md:p-12 rounded-2xl mb-8" style={{ backgroundColor: '#1E1E1E' }}>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">VOS MATURITY MODEL</h3>
              <p className="text-sm" style={{ color: '#707070' }}>Your roadmap to value engineering excellence</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div className="relative">
                <div className="aspect-square rounded-xl p-6 flex flex-col justify-between" style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid rgba(239, 68, 68, 0.5)'
                }}>
                  <div>
                    <div className="text-xs font-mono mb-2" style={{ color: '#E0E0E0' }}>LEVEL 1</div>
                    <h4 className="text-lg font-bold text-white mb-2">Value Chaos</h4>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: '#E0E0E0' }}>
                    <p>• No standardized value metrics</p>
                    <p>• Reactive sales approach</p>
                    <p>• Feature-focused selling</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square rounded-xl p-6 flex flex-col justify-between" style={{
                  backgroundColor: 'rgba(251, 146, 60, 0.15)',
                  border: '2px solid rgba(251, 146, 60, 0.5)'
                }}>
                  <div>
                    <div className="text-xs font-mono mb-2" style={{ color: '#E0E0E0' }}>LEVEL 2</div>
                    <h4 className="text-lg font-bold text-white mb-2">Value Aware</h4>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: '#E0E0E0' }}>
                    <p>• Basic ROI calculators</p>
                    <p>• Inconsistent messaging</p>
                    <p>• Limited case studies</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square rounded-xl p-6 flex flex-col justify-between" style={{
                  backgroundColor: 'rgba(250, 204, 21, 0.15)',
                  border: '2px solid rgba(250, 204, 21, 0.5)'
                }}>
                  <div>
                    <div className="text-xs font-mono mb-2" style={{ color: '#E0E0E0' }}>LEVEL 3</div>
                    <h4 className="text-lg font-bold text-white mb-2">Value Defined</h4>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: '#E0E0E0' }}>
                    <p>• Documented value framework</p>
                    <p>• Repeatable processes</p>
                    <p>• Cross-team alignment</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square rounded-xl p-6 flex flex-col justify-between" style={{
                  backgroundColor: 'rgba(0, 174, 239, 0.15)',
                  border: '2px solid rgba(0, 174, 239, 0.5)'
                }}>
                  <div>
                    <div className="text-xs font-mono mb-2" style={{ color: '#E0E0E0' }}>LEVEL 4</div>
                    <h4 className="text-lg font-bold text-white mb-2">Value Managed</h4>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: '#E0E0E0' }}>
                    <p>• Data-driven insights</p>
                    <p>• Proactive optimization</p>
                    <p>• Customer lifecycle focus</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square rounded-xl p-6 flex flex-col justify-between" style={{
                  backgroundColor: 'rgba(0, 255, 157, 0.15)',
                  border: '2px solid rgba(0, 255, 157, 0.5)'
                }}>
                  <div>
                    <div className="text-xs font-mono mb-2" style={{ color: '#E0E0E0' }}>LEVEL 5</div>
                    <h4 className="text-lg font-bold text-white mb-2">Value Optimized</h4>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: '#E0E0E0' }}>
                    <p>• Full VOS implementation</p>
                    <p>• AI-powered insights</p>
                    <p>• Industry leadership</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 rounded-xl" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#ef4444' }}>Level 1: Value Chaos</div>
              <p className="text-xs" style={{ color: '#707070' }}>
                Starting point where organizations recognize the need for systematic value measurement
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl" style={{
              backgroundColor: 'rgba(250, 204, 21, 0.05)',
              border: '1px solid rgba(250, 204, 21, 0.2)'
            }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#facc15' }}>Level 2-3: Value Alignment</div>
              <p className="text-xs" style={{ color: '#707070' }}>
                Building frameworks and establishing processes, with clear value methodologies in place
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl" style={{
              backgroundColor: 'rgba(0, 255, 157, 0.05)',
              border: '1px solid rgba(0, 255, 157, 0.2)'
            }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#00FF9D' }}>Level 4-5: Value Orchestration</div>
              <p className="text-xs" style={{ color: '#707070' }}>
                Mature VOS practices with data-driven optimization and continuous value delivery
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: '#1E1E1E' }}>
        <div className="absolute inset-0 bg-grid-small opacity-20"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Value Delivery?
          </h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#707070' }}>
            Join professionals from leading organizations who are mastering the Value Operating System
          </p>
          <button className="h-12 px-8 rounded-full text-base font-semibold transition-all" style={{
            backgroundColor: '#00FF9D',
            color: '#0A0A0A',
            boxShadow: '0 0 20px rgba(0, 255, 157, 0.3)'
          }}>
            Enroll in VOS Academy
          </button>
        </div>
      </section>
    </div>
  );
}
