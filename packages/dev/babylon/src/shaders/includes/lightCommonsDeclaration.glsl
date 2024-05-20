uniform vec3 uAmbientLight;
uniform HemisphericLight uHemiLight;
uniform PointLight uPointLights[MAX_POINT_LIGHTS];
uniform SpotLight uSpotLights[MAX_SPOT_LIGHTS];
uniform int uNumPointLights;
uniform int uNumSpotLights;
#if defined(SPECULAR)
    uniform float uShininess;
    uniform vec3 uViewPosition;
#endif