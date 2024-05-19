struct PointLight {
        vec3 position;
        vec3 color;
        float intensity;
};
struct SpotLight {
    vec3 position;
    vec3 direction;
    vec3 color;
    float innerCutoff; 
    float outerCutoff; 
    float exponent; 
    float intensity;
};
struct HemisphericLight {
    vec3 skyColor;
    vec3 groundColor;
    vec3 direction;
    float intensity;
};
vec3 calculateHemisphericLight(HemisphericLight light,vec3 normal) {
    float hemiLightFactor=max(dot(normal,normalize(light.direction)),0.0);
    return mix(light.groundColor,light.skyColor,hemiLightFactor) * light.intensity;
}
vec3 calculatePointLight(PointLight light,vec3 normal,vec3 pos) {
    vec3 lightDir=normalize(light.position-pos);
    float diff=max(dot(normal,lightDir),0.0);
    return diff*light.color*light.intensity;
}

vec3 calculateSpotLight(SpotLight light,vec3 normal,vec3 pos) {
    vec3 lightDir = normalize(light.position - pos);

    // intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.innerCutoff - light.outerCutoff;
    float intensity = clamp((theta - light.outerCutoff) / epsilon, 0.0, 1.0);
    intensity = pow(intensity, 2.0); // smooth border

    // diffuse
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = light.color * light.intensity * intensity;
    return diffuse;
}

#ifndef MAX_POINT_LIGHTS
    #define MAX_POINT_LIGHTS 3
#endif
#ifndef MAX_SPOT_LIGHTS
    #define MAX_SPOT_LIGHTS 3
#endif

vec3 calculateLight(vec3 ambient, HemisphericLight hemispheric,PointLight pointlights[MAX_POINT_LIGHTS],int countPointLights,SpotLight spotLights[MAX_SPOT_LIGHTS],int countSpotLights,vec3 normal,vec3 pos){
    vec3 color = calculateHemisphericLight(hemispheric,normal);
    for (int i=0; i<countPointLights; i++) {
        color+=calculatePointLight(pointlights[i],normal,pos);
    }
    for (int i=0; i<countSpotLights; i++) {
        color+=calculateSpotLight(spotLights[i],normal,pos);
    }
    return color + ambient;
}

vec3 calculatePhongSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess, vec3 lightColor) {
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    return spec * lightColor;
}

vec3 calculateBlinnPhongSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess, vec3 lightColor) {
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
    return spec * lightColor;
}