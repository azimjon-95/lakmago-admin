import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "@/store/auth";
import { useStoppedCount } from "@/hooks/useStoppedCount";
import { usePendingTransfers } from "@/hooks/usePendingTransfers";
import { useDineInStatus } from "@/hooks/useDineInStatus";


// =======================
// ADMIN MENU
// =======================

const adminNav = [
  {
    to: "/",
    icon: "ti-layout-dashboard",
    label: "Boshqaruv",
    end: true,
  },
  {
    to: "/restaurants",
    icon: "ti-building-store",
    label: "Muassasalar",
  },
  {
    to: "/orders",
    icon: "ti-clipboard-list",
    label: "Buyurtmalar",
  },
  {
    to: "/revenue",
    icon: "ti-cash",
    label: "Daromad",
  },
  {
    to: "/banners",
    icon: "ti-photo",
    label: "Bannerlar",
  },
  {
    to: "/support",
    icon: "ti-message-circle",
    label: "Xabarlar",
  },
  {
    to: "/groups",
    icon: "ti-brand-telegram",
    label: "Guruhlar",
  },
  {
    to: "/catalog",
    icon: "ti-package",
    label: "Katalog",
  },
  {
    to: "/promo-admin",
    icon: "ti-speakerphone",
    label: "Mijoz jalb qilish",
  },
  {
    to: "/dine-in-admin",
    icon: "ti-armchair",
    label: "Dine-in",
  },
  {
    to: "/billing",
    icon: "ti-report-money",
    label: "Moliya",
  },
  {
    to: "/settings",
    icon: "ti-settings",
    label: "Sozlamalar",
  },
];



// =======================
// RESTAURANT MENU
// =======================

const restaurantNav = [
  {
    to: "/",
    icon: "ti-clipboard-list",
    label: "Buyurtmalar",
    end:true,
  },
  {
    to: "/menu",
    icon:"ti-book",
    label:"Menyu",
  },
  {
    to:"/stop-list",
    icon:"ti-ban",
    label:"Stop List",
    badge:"stopped"
  },
  {
    to:"/menu-transfer",
    icon:"ti-transfer",
    label:"Ko'chirish",
    badge:"transfers"
  },
  {
    to:"/dine-in-live",
    icon:"ti-bell-ringing",
    label:"Zal buyurtmalari",
    dineInOnly:true
  },
  {
    to:"/dine-in",
    icon:"ti-armchair",
    label:"Dine-in"
  },
  {
    to:"/dine-in-history",
    icon:"ti-history",
    label:"Zal tarixi",
    dineInOnly:true
  },
  {
    to:"/reservations",
    icon:"ti-calendar-check",
    label:"Bronlar"
  },
  {
    to:"/promotion",
    icon:"ti-speakerphone",
    label:"Mijoz jalb qilish"
  },
  {
    to:"/banner",
    icon:"ti-photo",
    label:"Banner"
  },
  {
    to:"/profile",
    icon:"ti-settings",
    label:"Sozlamalar"
  }
];




// =======================
// COMPONENT
// =======================


export function Sidebar(){

const user = useAuth((s)=>s.user);
const restaurant = useAuth((s)=>s.restaurant);
const logout = useAuth((s)=>s.logout);


const isAdmin = user?.role==="admin";

// Dine-in tasdiqlanmaguncha zal bo'limlari ko'rinmaydi
const {isActive: dineInActive}=useDineInStatus(!isAdmin);

const nav = (isAdmin ? adminNav : restaurantNav)
  .filter((item) => !item.dineInOnly || dineInActive);

// Mobilda pastda 4 ta, qolgani "Ko'proq" da
const MOBILE_TABS = 4;
const primaryNav = nav.slice(0, MOBILE_TABS);
const moreNav = nav.slice(MOBILE_TABS);


const {count: stoppedCount}=useStoppedCount(!isAdmin);
const {count: transferCount}=usePendingTransfers(!isAdmin);

// "Ko'proq" ichidagi bildirishnomalar yig'indisi
const moreBadge = moreNav.reduce((sum, item) => {
  if (item.badge === "stopped") return sum + stoppedCount;
  if (item.badge === "transfers") return sum + transferCount;
  return sum;
}, 0);



const location = useLocation();

const [open,setOpen]=useState(false);



useEffect(()=>{

 setOpen(false);

},[location.pathname]);



useEffect(()=>{

document.body.style.overflow=open ? "hidden" : "";

return ()=>{
 document.body.style.overflow="";
}

},[open]);




const title =
isAdmin
?"Administrator"
:restaurant?.name || "Restoran";



const subtitle =
isAdmin
?"Dastur egasi"
:"Restoran paneli";



const initials =
(
isAdmin
?"AD"
:(restaurant?.name || "R")
)
.slice(0,2)
.toUpperCase();





// =======================
// NAV ITEM
// =======================


const NavItem=({item,onClick})=>(

<NavLink

to={item.to}

end={item.end}

onClick={onClick}

className={({isActive})=>

`
group
flex
items-center
gap-3
px-3
py-3
rounded-xl
text-sm
transition-all

${
isActive

?
"bg-brand-400 text-brand-text shadow"

:

"text-[#D9B98C] hover:bg-white/5 hover:text-white"

}

`

}

>


<i

className={`
ti
${item.icon}
text-xl
transition-transform
group-hover:scale-110
`}

/>


<span className="flex-1 truncate">

{item.label}

</span>



{
item.badge==="stopped" && stoppedCount>0 &&

<span className="badge">

{stoppedCount}

</span>
}



{
item.badge==="transfers" && transferCount>0 &&

<span className="badge">

{transferCount}

</span>
}


</NavLink>

);





/* Pastki panel bandi */
const MobileTab=({item,badge})=>(
  <NavLink
    to={item.to}
    end={item.end}
    className={({isActive})=>
      `flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-opacity active:opacity-60 ${
        isActive ? "text-brand-100" : "text-[#D9B98C]"
      }`
    }
  >
    <div className="relative">
      <i className={`ti ${item.icon} text-[21px]`}/>
      {badge>0 && (
        <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </div>
    <span className="text-[10px] font-medium leading-none truncate max-w-[68px]">
      {item.label}
    </span>
  </NavLink>
);


/* "Ko'proq" varag'idagi karta */
const MobileCard=({item,onClick,badge})=>(
  <NavLink
    to={item.to}
    end={item.end}
    onClick={onClick}
    className={({isActive})=>
      `relative flex flex-col gap-2 p-3.5 rounded-2xl border transition-colors active:scale-[.97] ${
        isActive
          ? "bg-brand-400/20 border-brand-400/40 text-brand-100"
          : "bg-white/5 border-white/8 text-[#D9B98C]"
      }`
    }
  >
    <i className={`ti ${item.icon} text-xl`}/>
    <span className="text-[13px] font-medium leading-tight">{item.label}</span>

    {badge>0 && (
      <span className="absolute top-2.5 right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
        {badge}
      </span>
    )}
  </NavLink>
);


const Brand=()=>(
<div className="flex items-center gap-3">

<div className="
w-11
h-11
rounded-2xl
bg-brand-400
flex
items-center
justify-center
">

<i className="
ti
ti-tools-kitchen-2
text-brand-text
text-xl
"/>

</div>


<div>

<div className="text-white font-bold">
LokmaGo
</div>

<div className="text-xs text-white/50">
Restaurant OS
</div>


</div>


</div>
);





const Account=()=>(
<div className="space-y-3">


<div className="flex gap-3 items-center">


<div className="
w-11
h-11
rounded-full
bg-white/10
text-white
flex
items-center
justify-center
font-bold
">

{initials}

</div>


<div className="min-w-0">

<div className="text-white text-sm truncate">

{title}

</div>

<div className="text-xs text-white/50">

{subtitle}

</div>


</div>


</div>



<button

onClick={logout}

className="
w-full
py-3
rounded-xl
bg-white/5
text-white/70
hover:bg-red-500/20
hover:text-red-400
transition
"

>

Chiqish

</button>


</div>
);





return (

<>


{/* DESKTOP */}

<aside
 className="
 hidden lg:flex
 fixed
 left-0
 top-0
 bottom-0
 z-40

 w-[280px]

 flex-col

 bg-sidebar
 border-r
 border-white/10

 overflow-hidden
 "
>


<div className="
p-5
border-b
border-white/10
">

<Brand/>

</div>




<div className="
flex-1
overflow-y-auto
sidebar-scroll
p-4
">

<nav className="space-y-1">

{
nav.map(item=>(

<NavItem
key={item.to}
item={item}
/>

))

}

</nav>


</div>




<div className="
p-4
border-t
border-white/10
">

<Account/>

</div>



</aside>





{/* ══════════ MOBIL: yuqori panel ══════════ */}

<header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-sidebar/85 backdrop-blur-xl border-b border-white/10">
  <Brand/>

  <button
    onClick={()=>setOpen(true)}
    aria-label="Menyu"
    className="w-9 h-9 rounded-full bg-white/8 text-white flex items-center justify-center active:scale-90 transition-transform"
  >
    <i className="ti ti-dots text-lg"/>
  </button>
</header>


{/* ══════════ MOBIL: pastki navigatsiya ══════════ */}

<nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
  <div className="flex items-stretch">
    {primaryNav.map((item)=>(
      <MobileTab
        key={item.to}
        item={item}
        badge={
          item.badge==="stopped" ? stoppedCount
          : item.badge==="transfers" ? transferCount
          : 0
        }
      />
    ))}

    {moreNav.length>0 && (
      <button
        onClick={()=>setOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[#D9B98C] active:opacity-60 transition-opacity"
      >
        <div className="relative">
          <i className="ti ti-dots text-[21px]"/>
          {moreBadge>0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {moreBadge}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">Ko'proq</span>
      </button>
    )}
  </div>
</nav>


{/* ══════════ MOBIL: to'liq menyu ══════════ */}

{open && (
  <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">

    {/* Orqa fon */}
    <div
      onClick={()=>setOpen(false)}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_.2s_ease]"
    />

    {/* Pastdan chiqadigan varaq */}
    <div className="relative bg-sidebar rounded-t-3xl max-h-[85dvh] flex flex-col animate-[slideUp_.28s_cubic-bezier(.32,.72,0,1)]">

      {/* Tutqich */}
      <div className="flex-none pt-2.5 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto"/>
      </div>

      {/* Sarlavha */}
      <div className="flex-none flex items-center justify-between px-5 py-3">
        <Brand/>
        <button
          onClick={()=>setOpen(false)}
          className="w-8 h-8 rounded-full bg-white/8 text-white/70 flex items-center justify-center"
        >
          <i className="ti ti-x text-base"/>
        </button>
      </div>

      {/* Bandlar — ikki ustunda */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-2 gap-2">
          {nav.map((item)=>(
            <MobileCard
              key={item.to}
              item={item}
              onClick={()=>setOpen(false)}
              badge={
                item.badge==="stopped" ? stoppedCount
                : item.badge==="transfers" ? transferCount
                : 0
              }
            />
          ))}
        </div>
      </div>

      {/* Akkaunt */}
      <div className="flex-none px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/10">
        <Account/>
      </div>
    </div>
  </div>
)}

</>

)

}