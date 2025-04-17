//Visualization Sizing
const canvasWidth = 1920;
const canvasHeight = 700;
const borderSpace = 80;

let isSimulationActive = false;
let simulationVelocity = 5;
let simulationDate = new Date(2023, 0, 1);
let animationRequest = null;
let previousTimestamp = 0;
let isManualDateControl = false;

const vizCanvas = d3.select("#viz")
  .append("svg")
  .attr("width", canvasWidth)
  .attr("height", canvasHeight)
  .attr("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`)
  .attr("style", "max-width: 100%; height: auto;");

const definitions = vizCanvas.append("defs");

//Background design
function generateStarfield() {
  const celestialBackground = vizCanvas.append("g").attr("class", "starfield");
  const starCount = 300;
  const celestialBodies = [];
  
  for (let i = 0; i < starCount; i++) {
    const xPos = Math.random() * canvasWidth;
    const yPos = Math.random() * canvasHeight;
    const starSize = Math.random() * 1.5;
    const starBrightness = Math.random() * 0.8 + 0.2;
    celestialBodies.push({ xPos, yPos, starSize, starBrightness });
  }
  
  celestialBackground.selectAll("circle.star")
    .data(celestialBodies)
    .enter()
    .append("circle")
    .attr("class", "star")
    .attr("cx", d => d.xPos)
    .attr("cy", d => d.yPos)
    .attr("r", d => d.starSize)
    .attr("fill", "#ffffff")
    .attr("opacity", d => d.starBrightness);
    
  const brightStars = [];
  for (let i = 0; i < 20; i++) {
    const xPos = Math.random() * canvasWidth;
    const yPos = Math.random() * canvasHeight;
    brightStars.push({ xPos, yPos });
  }
  
  const brightStarGroup = celestialBackground.selectAll("g.large-star")
    .data(brightStars)
    .enter()
    .append("g")
    .attr("class", "large-star");
    
  //Glow
  const glowFilter = definitions.append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");
    
  glowFilter.append("feGaussianBlur")
    .attr("stdDeviation", "2")
    .attr("result", "coloredBlur");
    
  const glowMerge = glowFilter.append("feMerge");
  glowMerge.append("feMergeNode").attr("in", "coloredBlur");
  glowMerge.append("feMergeNode").attr("in", "SourceGraphic");
  
  //Glow for highlighted comets
  const intensiveGlowFilter = definitions.append("filter")
    .attr("id", "glow-strong")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");
    
  intensiveGlowFilter.append("feGaussianBlur")
    .attr("stdDeviation", "4")
    .attr("result", "coloredBlur");
    
  const intensiveGlowMerge = intensiveGlowFilter.append("feMerge");
  intensiveGlowMerge.append("feMergeNode").attr("in", "coloredBlur");
  intensiveGlowMerge.append("feMergeNode").attr("in", "SourceGraphic");
  
  //Larger stars with glow
  brightStarGroup.append("circle")
    .attr("cx", d => d.xPos)
    .attr("cy", d => d.yPos)
    .attr("r", 1.5)
    .attr("fill", "#a1c3ff")
    .attr("filter", "url(#glow)");
}

generateStarfield();

//Setup
const visualContainer = vizCanvas.append("g")
  .attr("transform", `translate(${canvasWidth/2},${canvasHeight/2})`);

//Tooltip
const infoTooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

//Scales
const distanceScale = d3.scaleLinear()
  .range([80, (canvasWidth/2) - borderSpace]);

const bodySizeScale = d3.scaleLinear()
  .range([4, 18]);

const periodColorScale = d3.scaleSequential(d3.interpolateRainbow);

//Set up the angle scale
const inclinationScale = d3.scaleLinear()
  .domain([0, 180])
  .range([0, Math.PI]);

//Data
d3.csv("data/comets.csv").then(rawData => {
  const celestialObjects = rawData.map(item => {
    return {
      name: item.designation,
      perihelion: +item.q,
      perihelionDate: item.tp_cal ? new Date(item.tp_cal) : null,
      diameter: +item.diameter || 2,
      eccentricity: +item.e,
      inclination: +item.i,
      period: computeOrbitalPeriod(+item.q, +item.e), //Period from perihelion and eccentricity
      currentAngle: Math.random() * 2 * Math.PI,
      calculatedPosition: { x: 0, y: 0 },
      isNearPerihelion: false,
      isApproachingPerihelion: false
    };
  })
  //Borisov Planet N/A
  .filter(item => !isNaN(item.perihelion) && item.perihelion > 0 && !item.name.includes("Borisov"));

  const maxPerihelionValue = d3.max(celestialObjects, item => item.perihelion);
  const maxDiameterValue = d3.max(celestialObjects, item => item.diameter);
  const maxPeriodValue = d3.max(celestialObjects, item => item.period);
  distanceScale.domain([0, maxPerihelionValue]);
  bodySizeScale.domain([0, maxDiameterValue]);
  periodColorScale.domain([0, maxPeriodValue]);
  
  const radialGradient = definitions.append("radialGradient")
    .attr("id", "space-glow")
    .attr("cx", "50%")
    .attr("cy", "50%")
    .attr("r", "50%")
    .attr("fx", "50%")
    .attr("fy", "50%");
    
  radialGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "rgba(30, 55, 110, 0.15)");
    
  radialGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "rgba(10, 20, 40, 0)");
    
  visualContainer.append("circle")
    .attr("r", (canvasWidth/2) - 20)
    .attr("fill", "url(#space-glow)")
    .attr("opacity", 0.8);

  //Ring guide elements
  const ringValues = [0.5, 1, 2, 3, 4, 5];
  const filteredRings = ringValues.filter(d => d <= maxPerihelionValue);
  
  visualContainer.selectAll("circle.ring")
    .data(filteredRings)
    .enter()
    .append("circle")
    .attr("class", "ring")
    .attr("r", d => distanceScale(d))
    .attr("cx", 0)
    .attr("cy", 0)
    .style("stroke-dashoffset", "0")
    .style("animation", (d, i) => `dash ${10 + i * 5}s linear infinite`);
  
  //Keyframes for dash animation
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes dash {
      to {
        stroke-dashoffset: 30;
      }
    }
  `;
  document.head.appendChild(style);
    
  //Ring labels styling
  visualContainer.selectAll("text.ring-label")
    .data(filteredRings)
    .enter()
    .append("text")
    .attr("class", "ring-label")
    .attr("x", d => distanceScale(d))
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text(d => `${d} AU`)
    .attr("filter", "url(#glow)");

  //Earth
  const earthGroup = visualContainer.append("g").attr("class", "earth");
  earthGroup.append("circle")
    .attr("r", 20)
    .attr("fill", "rgba(76, 138, 255, 0.15)")
    .attr("filter", "url(#glow)");
  earthGroup.append("circle")
    .attr("r", 12)
    .attr("fill", "url(#earthGradient)")
    .attr("stroke", "#a1c3ff")
    .attr("stroke-width", 1.5);
  
  //Earth gradient
  const earthGradient = definitions.append("radialGradient")
    .attr("id", "earthGradient")
    .attr("cx", "40%")
    .attr("cy", "40%")
    .attr("r", "60%")
    .attr("fx", "40%")
    .attr("fy", "40%");
    
  earthGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#6db9ff");
    
  earthGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#2a56b5");
  
  earthGroup.append("circle")
    .attr("r", 12)
    .attr("fill", "url(#earthContinents)")
    .attr("opacity", 0.4);
    
  //Earth label
  earthGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", 30)
    .text("Earth")
    .attr("fill", "#c9d4ff")
    .attr("font-weight", "bold")
    .attr("filter", "url(#glow)");

  celestialObjects.forEach((d, i) => {
    const tailGradient = definitions.append("linearGradient")
      .attr("id", `tail-gradient-${i}`)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
      
    const color = periodColorScale(d.period);
    
    tailGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.9);
      
    tailGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0);
  });

  //Create the comet glyphs
  const cometsGroup = visualContainer.selectAll("g.comet")
    .data(celestialObjects)
    .enter()
    .append("g")
    .attr("class", "comet")
    .attr("transform", d => {
      const r = distanceScale(d.perihelion);
      const θ = inclinationScale(d.inclination);
      return `rotate(${θ * (180/Math.PI)}) translate(${r},0)`;
    });

  //Comet tails
  cometsGroup.each(function(d, i) {
    const cometGroup = d3.select(this);
    const tailLength = 25 + bodySizeScale(d.diameter) * 1.5; // Reduced from 30 to 25
    const cometSize = bodySizeScale(d.diameter);
    const tailGroup = cometGroup.append("g")
      .attr("class", "comet-tail");
    
    tailGroup.append("path")
      .attr("d", `M0,0 L-${tailLength},0`)
      .attr("stroke", `url(#tail-gradient-${i})`)
      .attr("stroke-width", cometSize * 0.6)
      .attr("fill", "none")
      .attr("opacity", 0.7)
      .attr("stroke-linecap", "round");
    
    //Styling for comet tails
    const numWisps = 2 + Math.floor(cometSize / 3);
    for (let j = 0; j < numWisps; j++) {
      const wispStart = (j + 1) / (numWisps + 1) * tailLength;
      const wispLength = tailLength * 0.2 * (0.5 + Math.random() * 0.5);
      const wispAngle = (Math.random() - 0.5) * 30;
      tailGroup.append("path")
        .attr("d", `M-${wispStart},0 L-${wispStart + wispLength},${wispLength * Math.tan(wispAngle * Math.PI / 180)}`)
        .attr("stroke", `url(#tail-gradient-${i})`)
        .attr("stroke-width", cometSize * (0.1 + Math.random() * 0.3))
        .attr("fill", "none")
        .attr("opacity", 0.4 + Math.random() * 0.3)
        .attr("stroke-linecap", "round");
    }
    
    const dustTailLength = tailLength * 0.7;
    const dustTailWidth = cometSize * 1.5;
    
    tailGroup.append("path")
      .attr("d", `M0,0 L-${dustTailLength},${dustTailWidth * 0.3}`)
      .attr("stroke", `url(#tail-gradient-${i})`)
      .attr("stroke-width", cometSize * 0.4)
      .attr("fill", "none")
      .attr("opacity", 0.25)
      .attr("stroke-linecap", "round");
      
    tailGroup.append("path")
      .attr("d", `M0,0 L-${dustTailLength},-${dustTailWidth * 0.3}`)
      .attr("stroke", `url(#tail-gradient-${i})`)
      .attr("stroke-width", cometSize * 0.4)
      .attr("fill", "none")
      .attr("opacity", 0.25)
      .attr("stroke-linecap", "round");
  });

  cometsGroup.append("circle")
    .attr("class", "nucleus")
    .attr("r", d => bodySizeScale(d.diameter))
    .attr("fill", d => periodColorScale(d.period))
    .attr("stroke", "rgba(255, 255, 255, 0.8)")
    .attr("stroke-width", 1)
    .attr("filter", "url(#glow)");
    
  cometsGroup.append("circle")
    .attr("class", "nucleus-highlight")
    .attr("r", d => bodySizeScale(d.diameter) * 0.4)
    .attr("cx", d => -bodySizeScale(d.diameter) * 0.2)
    .attr("cy", d => -bodySizeScale(d.diameter) * 0.2)
    .attr("fill", "rgba(255, 255, 255, 0.6)");

  //Perihelion glow
  cometsGroup.append("circle")
    .attr("class", "perihelion-indicator")
    .attr("r", d => bodySizeScale(d.diameter) * 1.8)
    .attr("fill", "none")
    .attr("stroke", "#ffcc00")
    .attr("stroke-width", 2)
    .attr("opacity", 0)
    .attr("stroke-dasharray", "3,3")
    .attr("filter", "url(#glow)");

  //FIXME

  //Tooltip comets
  cometsGroup
    .on("mouseover", (event, d) => {
      infoTooltip.transition()
        .duration(200)
        .style("opacity", 1);
      
      const formattedName = d.name.replace('/', ' / ');
      infoTooltip.html(`
        <strong>${formattedName}</strong><br>
        Perihelion: ${d.perihelion.toFixed(3)} AU<br>

        Diameter: ${d.diameter.toFixed(1)} km<br>
        Period: ${d.period.toFixed(1)} years<br>

        Inclination: ${d.inclination.toFixed(1)}°<br>
        Eccentricity: ${d.eccentricity.toFixed(3)}<br>
        ${d.perihelionDate ? `Next approach: ${formatDateString(d.perihelionDate)}` : ''}
      `)
      .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
      
      //Pulse effect
      const nucleus = d3.select(event.currentTarget).select(".nucleus");
      nucleus
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 2)
        .attr("filter", "url(#glow)")
        .transition()
        .duration(500)
        .attr("stroke-width", 3)
        .transition()
        .duration(500)
        .attr("stroke-width", 2);
    })
    //HIDING
    .on("mouseout", (event) => {
      infoTooltip.transition()
        .duration(500)
        .style("opacity", 0);
        
      d3.select(event.currentTarget)
        .select(".nucleus")
        .attr("stroke", "rgba(255, 255, 255, 0.8)")
        .attr("stroke-width", 1);
    })
    .on("click", (event, cometObj) => {
      //FIX BUBBLING
      event.stopPropagation();
      
      infoTooltip.transition()
        .duration(200)
        .style("opacity", 1);
      
      const formattedName = cometObj.name.replace('/', ' / ');
      
      infoTooltip.html(`
        <strong>${formattedName}</strong><br>
        Perihelion: ${cometObj.perihelion.toFixed(3)} AU<br>
        Diameter: ${cometObj.diameter.toFixed(1)} km<br>
        Period: ${cometObj.period.toFixed(1)} years<br>
        Inclination: ${cometObj.inclination.toFixed(1)}°<br>
        Eccentricity: ${cometObj.eccentricity.toFixed(3)}<br>
        ${cometObj.perihelionDate ? `Next approach: ${formatDateString(cometObj.perihelionDate)}` : ''}
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
      
      visualContainer.selectAll(".orbit-path").remove();
      
      const semiMajorAxis = cometObj.perihelion / (1 - cometObj.eccentricity);
      const focalDistance = semiMajorAxis * cometObj.eccentricity;
      const semiMinorAxis = Math.sqrt(semiMajorAxis * semiMajorAxis - focalDistance * focalDistance);
      
      const orbitPath = visualContainer.append("ellipse")
        .attr("class", "orbit-path")
        .attr("rx", distanceScale(semiMajorAxis))
        .attr("ry", distanceScale(semiMinorAxis))
        .attr("cx", -distanceScale(focalDistance))
        .attr("cy", 0)
        .attr("fill", "none")
        .attr("stroke", "#6d9dff")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,3")
        .attr("opacity", 0)
        .transition()
        .duration(500)
        .attr("opacity", 0.7);
      
      visualContainer.selectAll(".sun").remove();
      visualContainer.append("circle")
        .attr("class", "sun")
        .attr("cx", -distanceScale(focalDistance))
        .attr("cy", 0)
        .attr("r", 8)
        .attr("fill", "rgba(255, 215, 0, 0.9)")
        .attr("stroke", "rgba(255, 165, 0, 0.8)")
        .attr("stroke-width", 2)
        .attr("filter", "url(#glow-strong)")
        .attr("opacity", 0)
        .transition()
        .duration(500)
        .attr("opacity", 1);
      
      cometsGroup.selectAll(".comet")
        .classed("selected", false)
        .select(".nucleus")
        .attr("stroke", "rgba(255, 255, 255, 0.8)")
        .attr("stroke-width", 1);
      
      d3.select(event.currentTarget)
        .classed("selected", true)
        .select(".nucleus")
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 2)
        .attr("filter", "url(#glow-strong)");
    });

  //Legend for visualization
  const legend = vizCanvas.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${canvasWidth - 180}, ${canvasHeight - 140})`);
    
  legend.append("rect")
    .attr("width", 170)
    .attr("height", 140)
    .attr("fill", "rgba(10, 20, 50, 0.7)")
    .attr("stroke", "rgba(95, 129, 255, 0.4)")
    .attr("rx", 8);
  
    legend.append("rect")
      .attr("x", 10)
      .attr("y", 30)
      .attr("width", 150)
      .attr("height", 35)
      .attr("fill", "rgba(30, 50, 100, 0.3)")
      .attr("rx", 4);
    
    legend.append("rect")
      .attr("x", 10)
      .attr("y", 75)
      .attr("width", 150)
      .attr("height", 65)
      .attr("fill", "rgba(30, 50, 100, 0.3)")
      .attr("rx", 4);
    
    legend.append("text")
      .attr("x", 85)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#c9d4ff")
      .text("LEGEND")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");
    
    //COLOR LEGEND
    const gradientId = "legend-gradient";
    const gradient = legend.append("defs")
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%");
      
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const offset = i / (numStops - 1);
      gradient.append("stop")
        .attr("offset", `${offset * 100}%`)
        .attr("stop-color", periodColorScale(offset * maxPeriodValue));
    }
    
    legend.append("rect")
      .attr("x", 15)//RECT POSITIONING FIXME
      .attr("y", 35)
      .attr("width", 140)
      .attr("height", 12)
      .attr("rx", 5)
      .attr("fill", `url(#${gradientId})`)
      .attr("stroke", "rgba(255, 255, 255, 0.3)")
      .attr("stroke-width", 1);
      
    legend.append("text")
      .attr("x", 15)
      .attr("y", 62)
      .attr("font-size", "10px")
      .attr("fill", "#c9d4ff")
      .text("0 years");
      
    legend.append("text")
      .attr("x", 155)
      .attr("y", 62)
      .attr("fill", "#c9d4ff")
      .attr("text-anchor", "end")
      .attr("font-size", "10px")
      .text(`${Math.round(maxPeriodValue)} years`);
      
    legend.append("text")
      .attr("x", 85)
      .attr("y", 75)
      .attr("text-anchor", "middle")
      .attr("fill", "#c9d4ff")
      .attr("font-size", "12px")
      .text("Comet Diameter");
      
    legend.append("circle")
      .attr("cx", 45)
      .attr("cy", 95)
      .attr("r", bodySizeScale(5))
      .attr("fill", "#6d9dff")
      .attr("stroke", "white")
      .attr("stroke-width", 0.5);
      
    legend.append("text")
      .attr("x", 45)
      .attr("y", 122)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("fill", "#c9d4ff")
      .text("5 km");
      
    legend.append("circle")
      .attr("cx", 125)
      .attr("cy", 95)
      .attr("r", bodySizeScale(20))
      .attr("fill", "#6d9dff")
      .attr("stroke", "white")
      .attr("stroke-width", 0.5);
      
    legend.append("text")
      .attr("x", 125)
      .attr("y", 122)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("fill", "#c9d4ff")
      .text("20 km");

  //Period slider
  const periodSlider = document.getElementById("period-filter");
  const periodValue = document.getElementById("period-value");
  
  periodSlider.addEventListener("input", function() {
    const threshold = this.value;
    let displayText;
    
    if (parseInt(threshold) === 100) {
      displayText = "All comets";
    } else {
      displayText = `≤ ${threshold} years`;
    }
    periodValue.textContent = displayText;
    
    const percentValue = threshold / 100;
    const actualThreshold = Math.ceil(percentValue * maxPeriodValue);
    cometsGroup.transition()
      .duration(300)
      .style("opacity", d => d.period <= actualThreshold ? 1 : 0.1);
  });
  
  //comets animation loading
  cometsGroup
    .style("opacity", 0)
    .attr("transform", d => {
      const r = 0;
      const θ = inclinationScale(d.inclination);
      return `rotate(${θ * (180/Math.PI)}) translate(${r},0)`;
    })
    .transition()
    .duration(1500)
    .delay((d, i) => i * 20)
    .style("opacity", 1)
    .attr("transform", d => {
      const r = distanceScale(d.perihelion);
      const θ = inclinationScale(d.inclination);
      return `rotate(${θ * (180/Math.PI)}) translate(${r},0)`;
    });

  //remove tooltip on click
  vizCanvas.on("click", function(event) {
    if (event.target === this) {
      infoTooltip.transition()
        .duration(500)
        .style("opacity", 0);
        
      visualContainer.selectAll(".orbit-path").remove();
      visualContainer.selectAll(".sun").remove();
      
      visualContainer.selectAll(".comet")
        .classed("selected", false)
        .select(".nucleus")
        .attr("stroke", "rgba(255, 255, 255, 0.8)")
        .attr("stroke-width", 1)
        .attr("filter", null);
    }
  });

  initializeTimeSimulation(celestialObjects, cometsGroup);
});

//Orbital period formula
function computeOrbitalPeriod(perihelionDist, eccentricityValue) {
  if (isNaN(perihelionDist) || isNaN(eccentricityValue) || eccentricityValue >= 1) return 0;
  const semiMajorAxis = perihelionDist / (1 - eccentricityValue);
  return Math.sqrt(Math.pow(semiMajorAxis, 3));
}

function formatDateString(dateObject) {
  if (!dateObject || isNaN(dateObject.getTime())) return 'Unknown';
  return dateObject.toISOString().split('T')[0];
}

//Update date display
function refreshDateDisplay() {
  const dateDisplayElement = document.getElementById('currentDate');
  if (dateDisplayElement) {
    const formattedDate = simulationDate.toISOString().split('T')[0];
    
    //subtle animation
    dateDisplayElement.style.transition = 'none';
    dateDisplayElement.style.color = '#ffcc00'; // Highlight color
    dateDisplayElement.textContent = formattedDate;
    
    //Transition delay
    setTimeout(() => {
      dateDisplayElement.style.transition = 'color 0.5s ease';
      dateDisplayElement.style.color = '#6d9dff'; // Return to normal color
    }, 50);
  }
  
  refreshPerihelionEvents();
}

function refreshPerihelionEvents() {
  const eventsPanel = document.getElementById('perihelionEvents');
  if (!eventsPanel) return;
  // Clear current events
  eventsPanel.innerHTML = '';
  let eventCounter = 0;
  
  d3.selectAll('.comet').each(function(cometData) {
    if (cometData.isNearPerihelion) {
      eventCounter++;
      const eventElement = document.createElement('div');
      eventElement.className = 'perihelion-event';
      eventElement.setAttribute('data-comet-name', cometData.name);
      eventElement.innerHTML = `
        <span class="event-name">${cometData.name}</span>
        <span class="event-date">at perihelion</span>
      `;
      
      //hover interactions
      eventElement.addEventListener('mouseenter', () => emphasizeComet(cometData.name));
      eventElement.addEventListener('mouseleave', () => deemphasizeComet(cometData.name));
      
      eventsPanel.appendChild(eventElement);
    }
    
    if (cometData.isApproachingPerihelion) {
      eventCounter++;
      const eventElement = document.createElement('div');
      eventElement.className = 'perihelion-event upcoming';
      eventElement.setAttribute('data-comet-name', cometData.name);
      eventElement.innerHTML = `
        <span class="event-name">${cometData.name}</span>
        <span class="event-date">approaching perihelion</span>
      `;
      
      //hover interactions
      eventElement.addEventListener('mouseenter', () => emphasizeComet(cometData.name));
      eventElement.addEventListener('mouseleave', () => deemphasizeComet(cometData.name));
      
      eventsPanel.appendChild(eventElement);
    }
  });
  
  if (eventCounter === 0) {
    const noEventsElement = document.createElement('div');
    noEventsElement.className = 'no-events-message';
    noEventsElement.textContent = 'No perihelion events currently';
    eventsPanel.appendChild(noEventsElement);
  }
  
  eventsPanel.style.display = 'block';
}

//Highlight comet
function emphasizeComet(cometName) {
  d3.selectAll('.comet').each(function(cometData) {
    if (cometData.name === cometName) {
      const cometElement = d3.select(this);
      
      //pulse highlight effect
      cometElement.select('.nucleus')
        .attr('stroke', '#ffcc00')
        .attr('stroke-width', 3)
        .attr('filter', 'url(#glow-strong)');
      
      //outline highlight with pulsing animation
      cometElement.append('circle')
        .attr('class', 'hover-outline')
        .attr('r', function() {
          return d3.select(this.parentNode).select('.nucleus').attr('r') * 2.5;
        })
        .attr('fill', 'none')
        .attr('stroke', '#ffcc00')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.8)
        .style('animation', 'outline-pulse 1.5s infinite');
      
      //scroll to ensure the visualization is visible
      const vizContainer = document.getElementById('viz');
      if (vizContainer) {
        vizContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
}

//Remove highlight from a comet
function deemphasizeComet(cometName) {
  d3.selectAll('.comet').each(function(cometData) {
    if (cometData.name === cometName) {
      // Reset comet appearance if not near perihelion
      if (!cometData.isNearPerihelion) {
        d3.select(this).select('.nucleus')
          .attr('stroke', 'rgba(255, 255, 255, 0.8)')
          .attr('stroke-width', 1)
          .attr('filter', 'url(#glow)');
      }
      
      d3.select(this).select('.hover-outline').remove();
    }
  });
}

//Set up time simulation
function initializeTimeSimulation(celestialObjects, objectsGroup) {
  refreshDateDisplay();
  
  //EVENT LISTENERS
  const playPauseButton = document.getElementById('toggleSimulation');
  const restartButton = document.getElementById('resetSimulation');
  const velocitySlider = document.getElementById('simulationSpeed');
  const velocityDisplay = document.getElementById('speedValue');
  const timelineSlider = document.getElementById('dateSlider');

  playPauseButton.addEventListener('click', () => {
    if (isSimulationActive) {
      pauseSimulation();
      playPauseButton.textContent = 'Start Simulation';
    } else {
      beginSimulation(celestialObjects, objectsGroup);
      playPauseButton.textContent = 'Pause Simulation';
    }
  });
  
  restartButton.addEventListener('click', () => {
    restartSimulation(celestialObjects, objectsGroup);
    timelineSlider.value = 0; // Reset date slider
  });
  
  velocitySlider.addEventListener('input', function() {
    simulationVelocity = +this.value;
    velocityDisplay.textContent = simulationVelocity;
  });
  
  timelineSlider.addEventListener('input', function() {
    if (isSimulationActive) {
      pauseSimulation();
      playPauseButton.textContent = 'Start Simulation';
    }
    
    isManualDateControl = true;
    
    const daysElapsed = +this.value;
    simulationDate = new Date(2023, 0, 1);
    simulationDate.setDate(simulationDate.getDate() + daysElapsed);
    refreshDateDisplay();
    
    celestialObjects.forEach(cometObj => {
      const periodInDays = cometObj.period * 365.25;
      
      if (periodInDays <= 0) {
        cometObj.currentAngle = Math.random() * 2 * Math.PI;
      } else {
        const orbitProgress = (daysElapsed % periodInDays) / periodInDays;
        cometObj.currentAngle = orbitProgress * 2 * Math.PI;
      }
      
      recalculateCometPosition(cometObj);
      assessPerihelionProximity(cometObj);
    });
    
    refreshCometDisplays(celestialObjects, objectsGroup);
    refreshPerihelionEvents();
  });
  
  updateAllCometPositions(celestialObjects);
}

//Start time simulation
function beginSimulation(celestialObjects, objectsGroup) {
  if (isSimulationActive) return;
  
  isSimulationActive = true;
  previousTimestamp = performance.now();
  animationRequest = requestAnimationFrame((timestamp) => processAnimationFrame(timestamp, celestialObjects, objectsGroup));
}

// Stop time simulation
function pauseSimulation() {
  isSimulationActive = false;
  if (animationRequest) {
    cancelAnimationFrame(animationRequest);
    animationRequest = null;
  }
}

//Reset simulation to initial state
function restartSimulation(celestialObjects, objectsGroup) {
  pauseSimulation();
  
  simulationDate = new Date(2023, 0, 1);
  refreshDateDisplay();
  
  celestialObjects.forEach(cometObj => {
    cometObj.currentAngle = Math.random() * 2 * Math.PI;
  });
  
  updateAllCometPositions(celestialObjects);
  refreshCometDisplays(celestialObjects, objectsGroup);
  
  //Reset toggle button
  document.getElementById('toggleSimulation').textContent = 'Start Simulation';
}

//Animation frame handler
function processAnimationFrame(timestamp, celestialObjects, objectsGroup) {
  if (!isSimulationActive) return;
  
  const elapsedTime = timestamp - previousTimestamp;
  previousTimestamp = timestamp;
  
  // Advance the date
  //Each frame advances by days proportional to simulation speed
  const daysToIncrement = (elapsedTime / 1000) * simulationVelocity * 15;
  simulationDate.setDate(simulationDate.getDate() + daysToIncrement);
  
  // Update date display
  refreshDateDisplay();
  
  if (!isManualDateControl) {
    const timelineSlider = document.getElementById('dateSlider');
    const startDate = new Date(2023, 0, 1);
    const elapsedDays = Math.floor((simulationDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (elapsedDays >= 0 && elapsedDays <= 1095) {
      timelineSlider.value = elapsedDays;
    } else if (elapsedDays > 1095) {
      restartSimulation(celestialObjects, objectsGroup);
    }
  } else {
    isManualDateControl = false;
  }
  
  celestialObjects.forEach(cometObj => {
    updateOrbitalPosition(cometObj, daysToIncrement);
    assessPerihelionProximity(cometObj);
  });
  refreshCometDisplays(celestialObjects, objectsGroup);
  
  animationRequest = requestAnimationFrame((timestamp) => processAnimationFrame(timestamp, celestialObjects, objectsGroup));
}

//Update orbit position
function updateOrbitalPosition(cometObj, daysToIncrement) {
  const periodInDays = cometObj.period * 365.25;
  const orbitalFraction = daysToIncrement / periodInDays;
  cometObj.currentAngle = (cometObj.currentAngle + (orbitalFraction * 2 * Math.PI)) % (2 * Math.PI);
  recalculateCometPosition(cometObj);
}

function updateAllCometPositions(celestialObjects) {
  celestialObjects.forEach(cometObj => {
    recalculateCometPosition(cometObj);
    assessPerihelionProximity(cometObj);
  });
}

function recalculateCometPosition(cometObj) {
  const semiMajorAxis = cometObj.perihelion / (1 - cometObj.eccentricity);
  const orbitRadius = semiMajorAxis * (1 - Math.pow(cometObj.eccentricity, 2)) / (1 + cometObj.eccentricity * Math.cos(cometObj.currentAngle));

  cometObj.calculatedPosition = {
    x: orbitRadius * Math.cos(cometObj.currentAngle),
    y: orbitRadius * Math.sin(cometObj.currentAngle)
  };
}

function assessPerihelionProximity(cometObj) {
  cometObj.isNearPerihelion = false;
  cometObj.isApproachingPerihelion = false;
  
  if (cometObj.perihelionDate) {
    const daysDifference = Math.abs(simulationDate - cometObj.perihelionDate) / (1000 * 60 * 60 * 24);
    
    if (daysDifference < 30) {
      cometObj.isNearPerihelion = true;
    } 
    else if (cometObj.perihelionDate > simulationDate && 
             (cometObj.perihelionDate - simulationDate) / (1000 * 60 * 60 * 24) < 90) {
      cometObj.isApproachingPerihelion = true;
    }
  } 
  else if (cometObj.period > 0) {
    const perihelionAngle = 0;
    const angularDistance = Math.abs(cometObj.currentAngle % (2 * Math.PI) - perihelionAngle);
    
    if (angularDistance < 0.1 || angularDistance > (2 * Math.PI - 0.1)) {
      cometObj.isNearPerihelion = true;
    }
    else if (cometObj.currentAngle > 5.9 && cometObj.currentAngle < 6.28) {
      cometObj.isApproachingPerihelion = true;
    }
  }
}

//refresh comet displays
function refreshCometDisplays(celestialObjects, objectsGroup) {
  objectsGroup.each(function(d, i) {
    const cometElement = d3.select(this);
    const cometData = celestialObjects[i];
    const xCoord = distanceScale(cometData.calculatedPosition.x);
    const yCoord = distanceScale(cometData.calculatedPosition.y);
    cometElement.attr("transform", `translate(${xCoord},${yCoord})`);
    const tailDirection = (Math.atan2(cometData.calculatedPosition.y, cometData.calculatedPosition.x) * 180 / Math.PI) + 180;

    cometElement.select(".comet-tail").attr("transform", `rotate(${tailDirection})`);
    cometElement.select(".perihelion-indicator")
      .transition()
      .duration(300)
      .attr("opacity", cometData.isNearPerihelion ? 0.8 : 0)
      .attr("stroke", cometData.isNearPerihelion ? "#ffcc00" : 
                     (cometData.isApproachingPerihelion ? "#ff9900" : "#ffcc00"));
    
    //ec
    if (cometData.isNearPerihelion) {
      const nucleus = cometElement.select(".nucleus");
      nucleus
        .transition()
        .duration(1000)
        .attr("r", bodySizeScale(cometData.diameter) * 1.2)
        .attr("stroke-width", 2)
        .attr("stroke", "#ffcc00")
        .transition()
        .duration(1000)
        .attr("r", bodySizeScale(cometData.diameter))
        .attr("stroke-width", 1)
        .attr("stroke", "rgba(255, 255, 255, 0.8)")
        .on("end", function() {
          if (cometData.isNearPerihelion) {
            // Repeat the animation if still near perihelion
            this._timer = setTimeout(() => {
              if (isSimulationActive && cometData.isNearPerihelion) {
                nucleus
                  .transition()
                  .duration(1000)
                  .attr("r", bodySizeScale(cometData.diameter) * 1.2)
                  .attr("stroke-width", 2)
                  .attr("stroke", "#ffcc00")
                  .transition()
                  .duration(1000)
                  .attr("r", bodySizeScale(cometData.diameter))
                  .attr("stroke-width", 1)
                  .attr("stroke", "rgba(255, 255, 255, 0.8)");
              }
            }, 500);
          }
        });
    }
  });
} 