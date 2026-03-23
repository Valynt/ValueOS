import { files } from './files_registry.js';

document.addEventListener('DOMContentLoaded', () => {

    lucide.createIcons();

    const fileListContainer = document.getElementById('file-list');
    const codeContent = document.getElementById('code-content');
    const filenameDisplay = document.getElementById('current-filename');
    const copyBtn = document.getElementById('copy-btn');

    let currentFileKey = 'engine.py';


    function highlight(code) {
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

            .replace(new RegExp('#.*', 'g'), '<span class="token-comment">$&</span>')

            .replace(new RegExp('"(.*?)"', 'g'), '<span class="token-string">"$1"</span>')
            .replace(new RegExp("'(.*?)'", 'g'), '<span class="token-string">\'$1\'</span>')

            .replace(new RegExp('\\b(def|class|if|else|import|from|return|for|while|try|except|with|as|in|is|not|and|or)\\b', 'g'), '<span class="token-keyword">$&</span>')

            .replace(new RegExp('\\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\\()', 'g'), '<span class="token-function">$&</span>')

            .replace(new RegExp('\\b([A-Z][a-zA-Z0-9_]*)\\b', 'g'), '<span class="token-class">$&</span>')

            .replace(new RegExp('\\b\\d+(\\.\\d+)?\\b', 'g'), '<span class="token-number">$&</span>');
    }

    function renderCode(key) {
        const file = files[key];
        currentFileKey = key;
        filenameDisplay.textContent = key;
        codeContent.innerHTML = highlight(file.content);
        

        document.querySelectorAll('.file-nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.file === key);
        });
    }


    Object.keys(files).forEach(key => {
        const li = document.createElement('li');
        const icon = files[key].type === 'python' ? 'file-text' : (files[key].type === 'docker' ? 'container' : 'database');
        
        li.innerHTML = `
            <a href="javascript:void(0)" class="file-nav-link nav-link" data-file="${key}">
                <i data-lucide="${icon}"></i> ${key}
            </a>
        `;
        fileListContainer.appendChild(li);
    });


    lucide.createIcons();


    fileListContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.file-nav-link');
        if (link) {
            renderCode(link.dataset.file);
            document.getElementById('explorer').scrollIntoView({ behavior: 'smooth' });
        }
    });


    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(files[currentFileKey].content);
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Copied!`;
            lucide.createIcons();
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                lucide.createIcons();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    });


    renderCode('engine.py');
});
