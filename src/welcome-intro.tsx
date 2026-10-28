import React from 'react';
import { basePath } from './environment';

export function WelcomeIntro({code}:{code:string}) {
 return <section className="qoobee-welcome" aria-label="Qoobee Questions welcome screen">
  <img className="welcome-photo welcome-sunset" src={basePath+'intro/qoobee-sunset.png'} alt="Qoobee watching a desert sunset"/>
  <img className="welcome-photo welcome-samurai" src={basePath+'intro/qoobee-lakeside.png'} alt="Qoobee relaxing by the lake"/>
  <div className="welcome-title"><span>WELCOME TO</span><h1>Qoobee<br/><em>Questions</em></h1><p>Get your team ready!</p><div className="welcome-code"><span>ROOM CODE</span><strong>{code}</strong></div></div>
  <img className="welcome-photo welcome-concert" src={basePath+'intro/qoobee-samurai-closeup.png'} alt="Qoobee dressed as a samurai in front of a castle"/>
  <img className="welcome-photo welcome-piplup" src={basePath+'intro/qoobee-piplup.png'} alt="Qoobee and Piplup by the sea"/>
 </section>;
}
