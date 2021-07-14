import clsx from 'clsx';
import React, { useState } from 'react';
import { useHistory } from "react-router-dom";
import styles from './styles.module.css';

const ActionList = [
  {
    title: 'Decentral',
    link: 'docs/preface',
    description: (
      <>
        Based on a leaderless consensus protocol, IOTA 2.0 is the most decentralized distributed ledger protocol able to handle more than just payments. 
      </>
    ),
  },
  {
    title: 'Fast',
    link: 'docs/preface',
    description: (
      <>
        You can witness the Tangle network running with all of the new cutting-edge Nectar features.
      </>
    ),
  },
  {
    title: 'Feeless',
    link: 'docs/preface',
    description: (
      <>
        IOTA 2.0 enables the secure transfer of data and value between humans and machines, opening up new business models based on micro-payments.
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