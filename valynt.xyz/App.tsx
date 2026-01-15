import { Routes, Route } from 'react-router-dom';
import { SEO } from './components/SEO';
import { SkipNav } from './components/SkipNav';
import { ScrollToTop } from './components/ScrollToTop';
import { Analytics } from './components/Analytics';
import { Navigation } from './components/Navigation';
import { Home } from './components/Home';
import { Academy } from './components/Academy';
import Blog from './components/Blog';
import BlogPost from './components/BlogPost';
import { Footer } from './components/Footer';

function App() {
  return (
    <>
      <SEO />
      <SkipNav />
      <ScrollToTop />
      <Analytics />
      <div className="fixed inset-0 z-0 bg-grid pointer-events-none" aria-hidden="true"></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-dark)] pointer-events-none" aria-hidden="true"></div>

      <Navigation />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default App;
