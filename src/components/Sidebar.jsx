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


const {count: stoppedCount}=useStoppedCount(!isAdmin);
const {count: transferCount}=usePendingTransfers(!isAdmin);



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





{/* MOBILE HEADER */}

<header className="
lg:hidden
sticky
top:0
z-30
bg-sidebar
px-4
py-3
flex
justify-between
items-center
">


<Brand/>


<button

onClick={()=>setOpen(true)}

className="
text-white
text-2xl
"

>

<i className="ti ti-menu-2"/>

</button>


</header>





{/* MOBILE DRAWER */}

{
open &&

<div className="
fixed
inset-0
z-50
lg:hidden
flex
">

<div

onClick={()=>setOpen(false)}

className="
absolute
inset-0
bg-black/50
"

/>


<aside className="
relative
w-72
bg-sidebar
h-full
flex
flex-col
">


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
onClick={()=>setOpen(false)}
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


</div>

}



</>

)

}