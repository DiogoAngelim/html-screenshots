
# HTML Screenshots

This module generates a preview image from HTML content using Puppeteer. It allows the injection of custom CSS and JavaScript files, saves the generated image as a JPEG, and returns a base64 string representation of the image.
## Installation

Install HTML Screenshots with npm:

```bash
  npm install html-screenshots
```
    
    
## Usage/Examples

```javascript
import icon from 'html-screenshots';

const basePath: '/path/to/save/image',

const htmlContent = `
  <div>
    <h1>Hello, World!</h1>
    <p>This is a test.</p>
  </div>
`;

const options = {
  cssFiles: ['styles.css'],
  jsFiles: ['script.js']
};

(async () => {
  try {
    await icon(basePath, htmlContent, options);
  } catch (error) {
    console.error('Error generating image:', error.message);
  }
})();

```

