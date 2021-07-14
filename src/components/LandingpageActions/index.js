import clsx from 'clsx';
import React, { useState } from 'react';
import { useHistory } from "react-router-dom";
import styles from './styles.module.css';

const ActionList = [
  {
    title: 'Learn',
    link: 'docs/intro',
    description: (
      <>
        Learn the Basics about the IOTA Identity Framework and the concepts behind the Digital Identifier W3C standard. 
      </>
    ),
  },
  {
    title: 'Build',
    link: '/',
    description: (
      <>
        Follow our tutorial to build your own application. IOTA Identity supports Rust and Javascript (with WASM).
      </>
    ),
  },
  {
    title: 'Participate',
    link: '/',
    description: (
      <>
        You want to be a part of the IOTA mission? Join the IOTA community or join the IOTA Identity X-Team.
      </>
    ),
  },
];

function Action({ title, link, description}) {
  let [hovering, setHovering] = useState(false);
  let history = useHistory();

  const handleClick = (e) => {
    e.preventDefault();
    history.push(link);
  }

  return (
    <div className='col col--4 margin-vert--md'>
      <div
        className={clsx('card padding--lg')}
        onClick={handleClick}
        onMouseOver={() => setHovering(true)}
        onMouseOut={() => setHovering(false)}
      >
        <div className={clsx(styles.header)}>
          <span className={clsx(styles.headerTitle)}>{title}</span>
          <div href={link} className={clsx(styles.button)}>
            <span className={clsx("material-icons", styles.icon)}>
              navigate_next
            </span>
          </div>
        </div>
        <div className={clsx(
          "headline-stick",
          {
            "size-m": hovering,
            "size-s": !hovering
          }
        )}></div>
        <div className={clsx(styles.body)}>
          {description}
        </div>
      </div>
    </div>
  );
}

function LandingpageActions() {
  return (
    <div className='container padding--xl'>
      <div className="section-header grey text--center margin-bottom--sm" >Get started, right away</div>
      <div className='row'>
        {ActionList.map((props, idx) => (
          <Action key={idx} {...props} />
        ))}
      </div>
    </div>
  );
}

export default LandingpageActions