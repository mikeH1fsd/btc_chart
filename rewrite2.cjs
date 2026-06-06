const fs = require('fs');
const path = 'd:/finance_chart/src/BtcDetailChart.jsx';
let code = fs.readFileSync(path, 'utf8');

// Helper to do exact string replacement
function replaceExact(oldStr, newStr) {
    if (!code.includes(oldStr)) {
        console.error("COULD NOT FIND:", oldStr.substring(0, 50));
        process.exit(1);
    }
    code = code.replace(oldStr, newStr);
}

replaceExact(
    'const draggingRef = useRef(null);',
    'const draggingRef = useRef(null);\n  const dragPositionRef = useRef(null);'
);

replaceExact(
    '  const [overlayCoords, setOverlayCoords] = useState(null);',
    ''
);

replaceExact(
    `    const handlePointerMove = (e) => {
      if (!draggingRef.current || !seriesRef.current || !positionRef.current || !chartContainerRef.current) return;
      
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;
      
      const newPrice = seriesRef.current.coordinateToPrice(y);
      if (newPrice !== null) {
        setPosition(prev => {
          if (!prev) return prev;
          
          if (draggingRef.current === 'center') {
            const newEntry = newPrice;
            const priceDelta = newEntry - prev.entry;
            const newTime = chartInstanceRef.current.timeScale().coordinateToTime(x);
            
            return {
              ...prev,
              entry: newEntry,
              tp: prev.tp + priceDelta,
              sl: prev.sl + priceDelta,
              startTime: newTime !== null ? newTime : prev.startTime
            };
          } else {
            return { ...prev, [draggingRef.current]: newPrice };
          }
        });
      }
    };`,
    `    const handlePointerMove = (e) => {
      if (!draggingRef.current || !seriesRef.current || !positionRef.current || !chartContainerRef.current) return;
      
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;
      
      const newPrice = seriesRef.current.coordinateToPrice(y);
      if (newPrice !== null) {
        const prev = positionRef.current;
        if (draggingRef.current === 'center') {
          const newEntry = newPrice;
          const priceDelta = newEntry - prev.entry;
          const newTime = chartInstanceRef.current.timeScale().coordinateToTime(x);
          
          dragPositionRef.current = {
            ...prev,
            entry: newEntry,
            tp: prev.tp + priceDelta,
            sl: prev.sl + priceDelta,
            startTime: newTime !== null ? newTime : prev.startTime
          };
        } else {
          dragPositionRef.current = { ...prev, [draggingRef.current]: newPrice };
        }
      }
    };`
);

replaceExact(
    `    const handlePointerUp = () => {
      draggingRef.current = null;
      setDragging(null);
    };`,
    `    const handlePointerUp = () => {
      if (dragPositionRef.current) {
         setPosition(dragPositionRef.current);
         dragPositionRef.current = null;
      }
      draggingRef.current = null;
      setDragging(null);
    };`
);

replaceExact(
    `        if (entryY !== null && tpY !== null && slY !== null && startX !== null) {
          setOverlayCoords(prev => {
            if (prev && prev.entryY === entryY && prev.tpY === tpY && prev.slY === slY && prev.startX === startX && prev.endX === endX) return prev;
            return { entryY, tpY, slY, startX, endX };
          });
        } else {
          setOverlayCoords(prev => prev === null ? null : null);
        }
      } else {
        setOverlayCoords(prev => prev === null ? null : null);
      }`,
    `        const activePos = dragPositionRef.current || positionRef.current;
        
        const isLong = activePos.type === 'long';
        const profitTop = Math.min(entryY, tpY);
        const profitHeight = Math.abs(entryY - tpY);
        const lossTop = Math.min(entryY, slY);
        const lossHeight = Math.abs(entryY - slY);
        const profitUsd = isLong ? (activePos.tp - activePos.entry - (activePos.spread||0)) * activePos.lots : (activePos.entry - activePos.tp - (activePos.spread||0)) * activePos.lots;
        const lossUsd = isLong ? (activePos.sl - activePos.entry - (activePos.spread||0)) * activePos.lots : (activePos.entry - activePos.sl - (activePos.spread||0)) * activePos.lots;
        
        if (document.getElementById('tv-overlay-container')) document.getElementById('tv-overlay-container').style.display = 'block';
        
        if (document.getElementById('tv-profit-zone')) {
           document.getElementById('tv-profit-zone').style.top = profitTop + 'px';
           document.getElementById('tv-profit-zone').style.height = profitHeight + 'px';
           document.getElementById('tv-profit-zone').style.left = startX + 'px';
           document.getElementById('tv-profit-zone').style.width = (endX - startX) + 'px';
           document.getElementById('tv-profit-text').innerText = 'TP: $' + activePos.tp.toFixed(2) + ' | Profit: $' + profitUsd.toFixed(2);
        }
        if (document.getElementById('tv-loss-zone')) {
           document.getElementById('tv-loss-zone').style.top = lossTop + 'px';
           document.getElementById('tv-loss-zone').style.height = lossHeight + 'px';
           document.getElementById('tv-loss-zone').style.left = startX + 'px';
           document.getElementById('tv-loss-zone').style.width = (endX - startX) + 'px';
           document.getElementById('tv-loss-text').innerText = 'SL: $' + activePos.sl.toFixed(2) + ' | Loss: $' + lossUsd.toFixed(2);
        }
        if (document.getElementById('tv-entry-line')) document.getElementById('tv-entry-line').style.top = entryY + 'px';
        
        if (document.getElementById('tv-tp-guide')) document.getElementById('tv-tp-guide').style.top = tpY + 'px';
        if (document.getElementById('tv-sl-guide')) document.getElementById('tv-sl-guide').style.top = slY + 'px';
        if (document.getElementById('tv-center-guide')) document.getElementById('tv-center-guide').style.top = entryY + 'px';
        
        if (document.getElementById('tv-tp-handle')) document.getElementById('tv-tp-handle').style.top = tpY + 'px';
        if (document.getElementById('tv-sl-handle')) document.getElementById('tv-sl-handle').style.top = slY + 'px';
        if (document.getElementById('tv-center-handle')) document.getElementById('tv-center-handle').style.top = entryY + 'px';
        if (document.getElementById('tv-floating-panel')) document.getElementById('tv-floating-panel').style.top = entryY + 'px';
        
        if (document.getElementById('tv-rr-text')) {
           document.getElementById('tv-rr-text').innerText = (Math.abs(profitUsd) / Math.max(0.0001, Math.abs(lossUsd))).toFixed(2);
        }
      } else {
        if (document.getElementById('tv-overlay-container')) document.getElementById('tv-overlay-container').style.display = 'none';
      }`
);

replaceExact(
    'const entryY = seriesRef.current.priceToCoordinate(p.entry);',
    'const activePos = dragPositionRef.current || positionRef.current;\n        if (!activePos) { if (document.getElementById("tv-overlay-container")) document.getElementById("tv-overlay-container").style.display = "none"; animationFrameId = requestAnimationFrame(syncOverlay); return; }\n        const entryY = seriesRef.current.priceToCoordinate(activePos.entry);'
);
replaceExact(
    'const tpY = seriesRef.current.priceToCoordinate(p.tp);',
    'const tpY = seriesRef.current.priceToCoordinate(activePos.tp);'
);
replaceExact(
    'const slY = seriesRef.current.priceToCoordinate(p.sl);',
    'const slY = seriesRef.current.priceToCoordinate(activePos.sl);'
);
replaceExact(
    'const startX = chartInstanceRef.current.timeScale().timeToCoordinate(p.startTime);',
    'const startX = chartInstanceRef.current.timeScale().timeToCoordinate(activePos.startTime);'
);

// We need to replace renderPositionZones completely.
const zonesStartStr = `  const renderPositionZones = () => {`;
const zonesEndStr = `  return (
    <div className="modal-overlay"`;

const zonesStartIdx = code.indexOf(zonesStartStr);
const zonesEndIdx = code.indexOf(zonesEndStr);
if (zonesStartIdx === -1 || zonesEndIdx === -1) {
    console.error("COULD NOT FIND ZONES BLOCK");
    process.exit(1);
}

const zonesNew = `  const renderPositionZones = () => {
    if (!position) return null;
    const { lots, spread = 0 } = position;
    
    const handleStyle = {
      position: 'absolute', left: 0, right: 0, height: '14px',
      transform: 'translateY(-50%)', cursor: 'ns-resize', pointerEvents: 'auto', zIndex: 20
    };
    
    const profitColor = 'rgba(74, 222, 128, 0.15)'; 
    const profitBorder = '#4ade80';
    const lossColor = 'rgba(248, 113, 113, 0.15)'; 
    const lossBorder = '#f87171';

    return (
      <div id="tv-overlay-container" style={{ display: 'none', width: '100%', height: '100%', position: 'absolute', top:0, left:0 }}>
        <div id="tv-tp-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: \`1px dashed \${profitBorder}\`, opacity: dragging === 'tp' || dragging === 'center' ? 0.7 : 0 }} />
        <div id="tv-sl-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: \`1px dashed \${lossBorder}\`, opacity: dragging === 'sl' || dragging === 'center' ? 0.7 : 0 }} />
        <div id="tv-center-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1', opacity: dragging === 'center' ? 0.7 : 0 }} />

        <div id="tv-profit-zone" style={{ position: 'absolute', background: profitColor, borderTop: \`1px solid \${profitBorder}\`, borderBottom: \`1px solid \${profitBorder}\` }}>
           <div id="tv-profit-text" style={{ color: profitBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}></div>
        </div>
        
        <div id="tv-loss-zone" style={{ position: 'absolute', background: lossColor, borderTop: \`1px solid \${lossBorder}\`, borderBottom: \`1px solid \${lossBorder}\` }}>
           <div id="tv-loss-text" style={{ color: lossBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}></div>
        </div>
        
        <div id="tv-entry-line" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }} />
        
        <div id="tv-floating-panel" style={{ position: 'absolute', left: 'calc(100% + 10px)', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '4px 8px', pointerEvents: 'auto', zIndex: 40, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Lots</span>
             <input type="number" value={lots} onChange={e => { setPosition(p => ({...p, lots: parseFloat(e.target.value) || 0})); setLotsInput(e.target.value); }} step="0.01" min="0.01" style={{ width: '55px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} onPointerDown={e => e.stopPropagation()} />
           </div>
           <div style={{ width: '1px', height: '20px', background: '#334155' }} />
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Spread</span>
             <input type="number" value={spread} onChange={e => setPosition(p => ({...p, spread: parseFloat(e.target.value) || 0}))} step="0.1" min="0" style={{ width: '45px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} onPointerDown={e => e.stopPropagation()} />
           </div>
           <div style={{ width: '1px', height: '20px', background: '#334155' }} />
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <span style={{color: '#94a3b8', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'}}>R/R</span>
             <span id="tv-rr-text" style={{color: '#f8fafc', fontSize: '13px', fontWeight: 'bold'}}></span>
           </div>
        </div>

        <div id="tv-center-handle" style={{ position: 'absolute', height: '24px', left: 0, right: 0, transform: 'translateY(-50%)', cursor: 'move', pointerEvents: 'auto', zIndex: 30 }} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'center'; setDragging('center'); }} />
        <div id="tv-tp-handle" style={handleStyle} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'tp'; setDragging('tp'); }} />
        <div id="tv-sl-handle" style={handleStyle} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'sl'; setDragging('sl'); }} />
      </div>
    );
  };

`;

code = code.substring(0, zonesStartIdx) + zonesNew + code.substring(zonesEndIdx);

replaceExact('{position && overlayCoords && (', '{position && (');

fs.writeFileSync(path, code, 'utf8');
console.log("SUCCESS");

