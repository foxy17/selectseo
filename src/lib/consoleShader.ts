// WebGL Futuristic Shader for the animated "console HUD" background.
// Returns a cleanup function (cancels the rAF loop and frees GL resources),
// or null when WebGL is unavailable.
export function initShader(canvas: HTMLCanvasElement): (() => void) | null {
	const gl = canvas.getContext('webgl');
	if (!gl) {
		console.warn('WebGL not supported in this browser/environment');
		return null;
	}

	const vsSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

	const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;

      // Scale for grid
      vec2 gridUv = uv * vec2(30.0, 18.0);
      vec2 gridId = floor(gridUv);
      vec2 gridFract = fract(gridUv);

      // Grid lines with neon glow
      float lineThickness = 0.03;
      float gridX = smoothstep(lineThickness, 0.0, abs(gridFract.x - 0.5));
      float gridY = smoothstep(lineThickness, 0.0, abs(gridFract.y - 0.5));
      float gridVal = max(gridX, gridY);

      // Cyber pulse glitches
      float pulse = noise(vec2(u_time * 1.5, gridId.y)) * step(0.93, hash(vec2(gridId.y, floor(u_time * 4.0))));

      // Smooth scanning glowing wave
      float wavePos = fract(u_time * 0.12) * 2.0 - 0.5;
      float wave = smoothstep(0.18, 0.0, abs(uv.y - wavePos));

      // Dynamic futuristic plasma background
      float slowTime = u_time * 0.3;
      float plasma = sin(uv.x * 5.0 + slowTime) * cos(uv.y * 4.0 - slowTime) * 0.5 + 0.5;

      // Modern yellow/cyber theme palette: deep slate-charcoal, glowing cyber yellow, gold/orange pulse
      vec3 spaceBg = mix(vec3(0.01, 0.01, 0.015), vec3(0.04, 0.04, 0.025), plasma);
      vec3 cyberYellow = vec3(0.98, 1.0, 0.41); // #faff69
      vec3 cyberOrange = vec3(1.0, 0.65, 0.0);

      vec3 color = spaceBg;

      // Blend grid and wave
      color += cyberYellow * gridVal * 0.15 * (1.0 - uv.y * 0.3);
      color += cyberYellow * wave * 0.28;

      // Add random gold/orange pulses
      color += cyberOrange * pulse * gridVal * 0.35;

      // Vignette
      float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
      vignette = clamp(pow(16.0 * vignette, 0.5), 0.0, 1.0);
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

	function createShader(gl: WebGLRenderingContext, type: number, source: string) {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
	if (!vs || !fs) return null;

	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Program linking error:', gl.getProgramInfoLog(program));
		return null;
	}

	const positionAttr = gl.getAttribLocation(program, 'position');
	const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
	const timeUniform = gl.getUniformLocation(program, 'u_time');

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

	let animationId: number;
	const startTime = performance.now();

	function renderLoop() {
		if (!gl || !canvas) return;

		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}

		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(program);

		gl.enableVertexAttribArray(positionAttr);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

		gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
		gl.uniform1f(timeUniform, (performance.now() - startTime) / 1000.0);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		animationId = requestAnimationFrame(renderLoop);
	}

	renderLoop();

	return () => {
		cancelAnimationFrame(animationId);
		gl.deleteProgram(program);
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		gl.deleteBuffer(positionBuffer);
	};
}
