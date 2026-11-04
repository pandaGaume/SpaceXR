# Optional independent verification, requires SciPy. Not used by the renderer.
import json
import numpy as np
from scipy.special import spherical_jn, spherical_yn
from pathlib import Path

def reference(x,m):
    stop=int(np.ceil(x+4*x**(1/3)+2))
    a=[];b=[]
    for j in range(1,stop+1):
        px=x*spherical_jn(j,x);dp=spherical_jn(j,x)+x*spherical_jn(j,x,True)
        pm=m*x*spherical_jn(j,m*x);dm=spherical_jn(j,m*x)+m*x*spherical_jn(j,m*x,True)
        xi=px+1j*x*spherical_yn(j,x);dx=dp+1j*(spherical_yn(j,x)+x*spherical_yn(j,x,True))
        a.append((m*pm*dp-px*dm)/(m*pm*dx-xi*dm))
        b.append((pm*dp-m*px*dm)/(pm*dx-m*xi*dm))
    qsca=2/x**2*sum((2*j+1)*(abs(an)**2+abs(bn)**2) for j,(an,bn) in enumerate(zip(a,b),1))
    qext=2/x**2*sum((2*j+1)*(an+bn).real for j,(an,bn) in enumerate(zip(a,b),1))
    phases=[]
    for mu in [-1,-0.5,0,0.9,0.999,1]:
        p0=0;p1=1;s1=0j;s2=0j
        for j,(an,bn) in enumerate(zip(a,b),1):
            t=j*mu*p1-(j+1)*p0;f=(2*j+1)/(j*(j+1))
            s1+=f*(an*p1+bn*t);s2+=f*(an*t+bn*p1)
            p0,p1=p1,(2*j+1)/j*mu*p1-(j+1)/j*p0
        phases.append({'mu':mu,'value':(abs(s1)**2+abs(s2)**2)/(2*np.pi*x*x*qsca)})
    return {'x':x,'n':m.real,'k':m.imag,'qScattering':float(qsca),'qExtinction':float(qext),'phases':phases}
report={'source':'Independent scipy.special spherical Bessel functions, direct boundary-condition coefficients. Script: mie-reference.py. SciPy 1.16.3.',
        'cases':[reference(x,complex(n,k)) for x,n,k in [(0.01,1.5,0),(2,1.5,0),(2,1.5,0.1),(17,1.5,0.003),(40,1.8,0.05)]]}
Path('test/fixtures/mie-reference.json').write_text(json.dumps(report,indent=2)+'\n')
