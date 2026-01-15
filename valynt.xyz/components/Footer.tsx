import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin } from 'lucide-react';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4 group w-fit">
              <Logo gradientId="logo_grad_footer" />
              <span className="text-xl font-brand font-bold tracking-tight text-white group-hover:opacity-90 transition-opacity">
                VALYNT
              </span>
            </Link>
            <p className="text-sm font-medium text-zinc-400 mb-4">Value Intelligence Platform</p>
            <p className="text-xs text-zinc-500 mb-6">
              The Value Operating System for the AI era.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-zinc-500 hover:text-white"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-zinc-500 hover:text-white"><Github className="w-4 h-4" /></a>
              <a href="#" className="text-zinc-500 hover:text-white"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li><a href="#" className="hover:text-zinc-300">VALYNT Engine</a></li>
              <li><a href="#" className="hover:text-zinc-300">VALYNT Graph</a></li>
              <li><a href="#" className="hover:text-zinc-300">VALYNT Agents</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li><a href="#" className="hover:text-zinc-300">Documentation</a></li>
              <li><a href="#" className="hover:text-zinc-300">Case Studies</a></li>
              <li><Link to="/academy" className="hover:text-zinc-300">VALYNT Academy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li><a href="#" className="hover:text-zinc-300">About</a></li>
              <li><a href="#" className="hover:text-zinc-300">Careers</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5">
          <span className="text-[10px] text-zinc-600">© 2024 VALYNT Inc. All rights reserved.</span>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="text-[10px] text-zinc-600 hover:text-zinc-400">Privacy Policy</a>
            <a href="#" className="text-[10px] text-zinc-600 hover:text-zinc-400">Terms of Service</a>
            <a href="/llms.txt" className="text-[10px] text-zinc-600 hover:text-zinc-400">For AI systems</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
