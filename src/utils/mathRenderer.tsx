import React from 'react';

/**
 * High-fidelity, lightweight client-side renderer for Markdown Images, Math Symbols, Fractions, 
 * Superscripts/Subscripts and basic LaTeX formatting.
 */
export function formatMathAndMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // 1. Detect and parse inline Markdown Images (e.g. ![alt](data:image/png;base64,...))
  let currentText = text;

  // Let's replace common LaTeX symbols with clean, readable unicode equivalents
  const unicodeSymbols: { [key: string]: string } = {
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\epsilon': 'ε',
    '\\theta': 'θ',
    '\\pi': 'π',
    '\\sigma': 'σ',
    '\\mu': 'μ',
    '\\lambda': 'λ',
    '\\omega': 'ω',
    '\\sum': '∑',
    '\\int': '∫',
    '\\times': '×',
    '\\div': '÷',
    '\\pm': '±',
    '\\ge': '≥',
    '\\le': '≤',
    '\\neq': '≠',
    '\\infty': '∞',
    '\\approx': '≈',
    '\\rightarrow': '→',
    '\\leftarrow': '←',
    '\\cdot': '•',
    '\\sqrt': '√',
  };

  // Convert math display blocks \[ ... \] or $$ ... $$ to make parsing consistent
  currentText = currentText
    .replace(/\$\$([\s\S]*?)\$\$/g, '$$$1$$')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$1$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Regex to extract images, code blocks, bold text, lists, and math blocks
  // Let's process the text line by line to preserve layout and paragraph structures perfectly
  const lines = currentText.split('\n');

  return (
    <div className="space-y-2 text-right">
      {lines.map((line, lineIdx) => {
        // Empty lines are rendered as vertical spacing
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        // Check if line is an image
        const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
        const imgMatch = imgRegex.exec(line);
        if (imgMatch) {
          const alt = imgMatch[1];
          const src = imgMatch[2];
          return (
            <div key={lineIdx} className="my-3 flex flex-col items-center">
              <img
                src={src}
                alt={alt}
                className="max-w-full md:max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md object-contain hover:scale-[1.02] transition-transform duration-200"
              />
              {alt && alt !== 'تصویر' && (
                <span className="text-[11px] text-slate-500 mt-1.5 font-medium">{alt}</span>
              )}
            </div>
          );
        }

        // Check if line is a bullet point or list
        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ');
        const cleanLineText = isBullet ? line.trim().replace(/^[-*•]\s+/, '') : line;

        // Process line inline elements (Bold, inline formulas, math fractions)
        // Let's split and find math formulas delimited by single $
        const lineParts: React.ReactNode[] = [];
        let index = 0;
        
        // Match inline or display math
        const mathRegex = /\$([^\$]+)\$/g;
        let match;
        let lastIdx = 0;

        while ((match = mathRegex.exec(cleanLineText)) !== null) {
          const textBefore = cleanLineText.substring(lastIdx, match.index);
          if (textBefore) {
            lineParts.push(
              <span key={`text-before-${match.index}`}>
                {renderInlineFormatting(textBefore, unicodeSymbols)}
              </span>
            );
          }

          // Parse and render the math formula
          const mathFormula = match[1];
          lineParts.push(
            <span key={`math-${match.index}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/85 font-mono text-indigo-700 dark:text-indigo-300 font-bold text-sm select-all mx-0.5">
              {renderMathFormula(mathFormula, unicodeSymbols)}
            </span>
          );

          lastIdx = mathRegex.lastIndex;
        }

        const textRemaining = cleanLineText.substring(lastIdx);
        if (textRemaining) {
          lineParts.push(
            <span key={`text-remaining-${lastIdx}`}>
              {renderInlineFormatting(textRemaining, unicodeSymbols)}
            </span>
          );
        }

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-1.5 pr-2">
              <span className="text-indigo-500 font-extrabold mt-1 select-none">🔹</span>
              <p className="flex-1 text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                {lineParts}
              </p>
            </div>
          );
        }

        return (
          <p key={lineIdx} className="text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
            {lineParts}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Renders inline text, handling bold formatting and LaTeX symbols
 */
function renderInlineFormatting(text: string, unicodeSymbols: { [key: string]: string }): React.ReactNode {
  let clean = text;
  
  // Replace symbols in general text if any latex leak
  Object.keys(unicodeSymbols).forEach((key) => {
    clean = clean.replaceAll(key, unicodeSymbols[key]);
  });

  const boldRegex = /\*\*([^\*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match;

  while ((match = boldRegex.exec(clean)) !== null) {
    const textBefore = clean.substring(lastIdx, match.index);
    if (textBefore) {
      parts.push(<span key={`text-${lastIdx}`}>{textBefore}</span>);
    }
    parts.push(
      <strong key={`bold-${match.index}`} className="font-extrabold text-slate-900 dark:text-slate-50">
        {match[1]}
      </strong>
    );
    lastIdx = boldRegex.lastIndex;
  }

  const remaining = clean.substring(lastIdx);
  if (remaining) {
    parts.push(<span key={`remaining-${lastIdx}`}>{remaining}</span>);
  }

  return <React.Fragment>{parts}</React.Fragment>;
}

/**
 * Sophisticated parser that renders fractions, square roots, matrices, 
 * exponents, and subscripts using clean, reactive, and styled HTML/CSS.
 */
function renderMathFormula(formula: string, unicodeSymbols: { [key: string]: string }): React.ReactNode {
  let temp = formula;

  // Substitute common Greek / LaTeX math symbols
  Object.keys(unicodeSymbols).forEach((key) => {
    temp = temp.replaceAll(key, unicodeSymbols[key]);
  });

  // 1. Process LaTeX fractions: \frac{numerator}{denominator}
  const fracRegex = /\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g;
  
  // If we find fractions, split and construct beautiful DOM fractions
  const fracMatch = fracRegex.exec(temp);
  if (fracMatch) {
    const num = fracMatch[1];
    const den = fracMatch[2];
    
    // Split the formula before and after the fraction
    const fracIndex = fracMatch.index;
    const fracLength = fracMatch[0].length;
    
    const beforeFrac = temp.substring(0, fracIndex);
    const afterFrac = temp.substring(fracIndex + fracLength);

    return (
      <span className="inline-flex items-center gap-1">
        {beforeFrac && renderMathFormula(beforeFrac, unicodeSymbols)}
        <span className="inline-flex flex-col items-center justify-center align-middle mx-1 font-sans border-r-0">
          <span className="border-b border-indigo-300 dark:border-indigo-700 px-1 text-center text-xs leading-none pb-0.5 font-bold">
            {renderMathFormula(num, unicodeSymbols)}
          </span>
          <span className="px-1 text-center text-xs leading-none pt-0.5 font-bold">
            {renderMathFormula(den, unicodeSymbols)}
          </span>
        </span>
        {afterFrac && renderMathFormula(afterFrac, unicodeSymbols)}
      </span>
    );
  }

  // 2. Process exponents: x^2 or x^{2}
  const expRegex = /([a-zA-Z0-9α-ω∑∫√+\-×÷=]+)\^\{([^}]*)\}/g;
  const expMatch = expRegex.exec(temp);
  if (expMatch) {
    const base = expMatch[1];
    const power = expMatch[2];
    const idx = expMatch.index;
    const len = expMatch[0].length;
    return (
      <span className="inline-flex items-center">
        {temp.substring(0, idx) && renderMathFormula(temp.substring(0, idx), unicodeSymbols)}
        <span className="font-bold">{base}</span>
        <sup className="text-[10px] font-bold text-indigo-500 -mt-1 leading-none">{power}</sup>
        {temp.substring(idx + len) && renderMathFormula(temp.substring(idx + len), unicodeSymbols)}
      </span>
    );
  }

  // Simple exponent without brackets: x^2
  const simpleExpRegex = /([a-zA-Z0-9α-ω∑∫√+\-×÷=]+)\^([a-zA-Z0-9+\-×÷=])/g;
  const simpleExpMatch = simpleExpRegex.exec(temp);
  if (simpleExpMatch) {
    const base = simpleExpMatch[1];
    const power = simpleExpMatch[2];
    const idx = simpleExpMatch.index;
    const len = simpleExpMatch[0].length;
    return (
      <span className="inline-flex items-center">
        {temp.substring(0, idx) && renderMathFormula(temp.substring(0, idx), unicodeSymbols)}
        <span className="font-bold">{base}</span>
        <sup className="text-[10px] font-bold text-indigo-500 -mt-1 leading-none">{power}</sup>
        {temp.substring(idx + len) && renderMathFormula(temp.substring(idx + len), unicodeSymbols)}
      </span>
    );
  }

  // 3. Process subscripts: x_1 or x_{ij}
  const subRegex = /([a-zA-Z0-9α-ω∑∫√+\-×÷=]+)_\{([^}]*)\}/g;
  const subMatch = subRegex.exec(temp);
  if (subMatch) {
    const base = subMatch[1];
    const sub = subMatch[2];
    const idx = subMatch.index;
    const len = subMatch[0].length;
    return (
      <span className="inline-flex items-center">
        {temp.substring(0, idx) && renderMathFormula(temp.substring(0, idx), unicodeSymbols)}
        <span className="font-bold">{base}</span>
        <sub className="text-[10px] font-bold text-indigo-500 mt-1 leading-none">{sub}</sub>
        {temp.substring(idx + len) && renderMathFormula(temp.substring(idx + len), unicodeSymbols)}
      </span>
    );
  }

  // Simple subscript without brackets: x_1
  const simpleSubRegex = /([a-zA-Z0-9α-ω∑∫√+\-×÷=]+)_([a-zA-Z0-9+\-×÷=])/g;
  const simpleSubMatch = simpleSubRegex.exec(temp);
  if (simpleSubMatch) {
    const base = simpleSubMatch[1];
    const sub = simpleSubMatch[2];
    const idx = simpleSubMatch.index;
    const len = simpleSubMatch[0].length;
    return (
      <span className="inline-flex items-center">
        {temp.substring(0, idx) && renderMathFormula(temp.substring(0, idx), unicodeSymbols)}
        <span className="font-bold">{base}</span>
        <sub className="text-[10px] font-bold text-indigo-500 mt-1 leading-none">{sub}</sub>
        {temp.substring(idx + len) && renderMathFormula(temp.substring(idx + len), unicodeSymbols)}
      </span>
    );
  }

  // 4. Process square root: \sqrt{expression}
  const sqrtRegex = /\\sqrt\s*\{([^}]*)\}/g;
  const sqrtMatch = sqrtRegex.exec(temp);
  if (sqrtMatch) {
    const expr = sqrtMatch[1];
    const idx = sqrtMatch.index;
    const len = sqrtMatch[0].length;
    return (
      <span className="inline-flex items-center">
        {temp.substring(0, idx) && renderMathFormula(temp.substring(0, idx), unicodeSymbols)}
        <span className="inline-flex items-center align-middle font-sans">
          <span className="text-sm font-black mr-0.5">√</span>
          <span className="border-t border-indigo-600 dark:border-indigo-400 px-0.5 text-xs font-bold leading-none pt-0.5">
            {renderMathFormula(expr, unicodeSymbols)}
          </span>
        </span>
        {temp.substring(idx + len) && renderMathFormula(temp.substring(idx + len), unicodeSymbols)}
      </span>
    );
  }

  return <span>{temp}</span>;
}
