// Homogeneous spheres in vacuum, m = n + i*k (passive absorption).
// Riccati-Bessel logarithmic derivatives evaluated by downward recurrence.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const scale=(a,b)=>[a[0]*b,a[1]*b], abs2=a=>a[0]**2+a[1]**2;
const div=(a,b)=>scale([a[0]*b[0]+a[1]*b[1],a[1]*b[0]-a[0]*b[1]],1/abs2(b));
export function mieSphere(x, n, k=0) {
    if (!(x>=0.001 && x<=400 && n>=1 && n<=3 && k>=0 && k<=1)) throw new Error('Mie domain: 0.001<=x<=400, 1<=n<=3, 0<=k<=1');
    const m=[n,k], z=scale(m,x), stop=Math.ceil(x+4*Math.cbrt(x)+2), limit=Math.ceil(Math.max(stop,Math.hypot(...z))+40);
    const D=Array.from({length:limit+1},()=>[0,0]);
    for(let j=limit;j>0;j--) {const a=div([j,0],z);D[j-1]=sub(a,div([1,0],add(D[j],a)));}
    let psi0=Math.sin(x),psi1=Math.sin(x)/x-Math.cos(x),chi0=-Math.cos(x),chi1=-Math.cos(x)/x-Math.sin(x);
    const a=[],b=[];let scattering=0,extinction=0;
    for(let j=1;j<=stop;j++) {
        const A=add(div(D[j],m),[j/x,0]),B=add(mul(m,D[j]),[j/x,0]);
        const xi=[psi1,chi1],prev=[psi0,chi0];
        const an=div(sub(scale(A,psi1),[psi0,0]),sub(mul(A,xi),prev));
        const bn=div(sub(scale(B,psi1),[psi0,0]),sub(mul(B,xi),prev));
        a.push(an);b.push(bn);scattering+=(2*j+1)*(abs2(an)+abs2(bn));extinction+=(2*j+1)*(an[0]+bn[0]);
        const psi=(2*j+1)/x*psi1-psi0,chi=(2*j+1)/x*chi1-chi0;
        psi0=psi1;psi1=psi;chi0=chi1;chi1=chi;
    }
    const qScattering=2*scattering/x**2,qExtinction=2*extinction/x**2;
    if(qExtinction < qScattering-1e-8 || !Number.isFinite(qExtinction)) throw new Error('Non-passive Mie solution');
    return {x,qScattering,qExtinction:Math.max(qScattering,qExtinction),phase(mu) {
        mu=Math.max(-1,Math.min(1,mu));let pi0=0,pi1=1,S1=[0,0],S2=[0,0];
        for(let j=1;j<=stop;j++) {
            const tau=j*mu*pi1-(j+1)*pi0,f=(2*j+1)/(j*(j+1));
            S1=add(S1,scale(add(scale(a[j-1],pi1),scale(b[j-1],tau)),f));
            S2=add(S2,scale(add(scale(a[j-1],tau),scale(b[j-1],pi1)),f));
            const next=(2*j+1)/j*mu*pi1-(j+1)/j*pi0;pi0=pi1;pi1=next;
        }
        return qScattering > 0 ? (abs2(S1)+abs2(S2))/(2*Math.PI*x*x*qScattering) : 0;
    }};
}
/** Number-weighted lognormal quadrature. Cross sections weight the resulting phase. */
export function dustOptics(wavelengthNm,{radiusUm=0.7,logSigma=0.3,indexN=1.5,indexK=0.003}={}) {
    if(!(radiusUm>=0.01 && radiusUm<=3 && logSigma>=0 && logSigma<=0.6)) throw new Error('Invalid dust size distribution');
    const samples=[];let normalization=0,scattering=0,extinction=0;
    const count=logSigma===0 ? 1 : 13;
    for(let i=0;i<count;i++) {
        const t=count===1 ? 0 : -3+6*i/(count-1),weight=Math.exp(-t*t/2)*(i===0||i===count-1 ? 0.5 : 1);
        const r=radiusUm*1e-6*Math.exp(logSigma*t),sphere=mieSphere(2*Math.PI*r/(wavelengthNm*1e-9),indexN,indexK);
        const area=Math.PI*r*r;
        samples.push({sphere,weight:weight*area*sphere.qScattering});normalization+=weight;
        scattering+=weight*area*sphere.qScattering;extinction+=weight*area*sphere.qExtinction;
    }
    return {scattering:scattering/normalization,extinction:extinction/normalization,
        phase(mu){return scattering > 0 ? samples.reduce((sum,v)=>sum+v.weight*v.sphere.phase(mu),0)/scattering : 0;}};
}
