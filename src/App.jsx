import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, Edit2, X, Save, ChevronLeft, ChevronRight, 
  Lock, LogOut, Menu, Upload, Image as ImageIcon, CheckCircle, RefreshCw
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, writeBatch
} from "firebase/firestore";

// --- ফায়ারবেস কনফিগারেশন ---
const firebaseConfig = {
  apiKey: "AIzaSyCDr8j4mCOZnygHnw8qnmHm_-5SasuqhvY",
  authDomain: "sample-firebase-ai-app-e155b.firebaseapp.com",
  databaseURL: "https://sample-firebase-ai-app-e155b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sample-firebase-ai-app-e155b",
  storageBucket: "sample-firebase-ai-app-e155b.firebasestorage.app",
  messagingSenderId: "189674121794",
  appId: "1:189674121794:web:7c6d901ee3d882980e9bdb",
  measurementId: "G-BCMZ2MYZT1"
};

// অ্যাপ ইনিশিয়ালাইজেশন
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'bangla-myths-v1'; // অ্যাপ আইডি ফিক্সড করে দিলাম যাতে ডাটা লোড হয়

// --- মক ডাটা ---
const INITIAL_MYTHS = [
  {
    title: "জোড়া কলা খেলে যমজ বাচ্চা হয়",
    description: "অনেকের ধারণা, কেউ যদি জোড়া লাগানো কলা খায়, তবে ভবিষ্যতে তার যমজ সন্তান হবে।",
    category: "খাবার",
    image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=600",
    isSlider: true
  },
  {
    title: "রাতে ঘর ঝাড়ু দিলে লক্ষ্মী চলে যায়",
    description: "রাতে ঘর ঝাড়ু দিলে নাকি ঘরের বরকত কমে যায়।",
    category: "সংসার",
    image: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&q=80&w=600",
    isSlider: true
  },
  {
    title: "কাক ডাকলে মেহমান আসে",
    description: "বাড়ির চালে বা বারান্দায় কাক ডাকলে সেদিন বাড়িতে কোনো অতিথি আসার সম্ভাবনা থাকে।",
    category: "প্রকৃতি",
    image: "https://images.unsplash.com/photo-1555663784-5a91ae19f94d?auto=format&fit=crop&q=80&w=600",
    isSlider: true
  },
  {
    title: "পরীক্ষার আগে ডিম খাওয়া অশুভ",
    description: "ডিম খেলে পরীক্ষায় 'গোল্লা' বা শূন্য পাবে - এই ভয়ে অনেক শিক্ষার্থী পরীক্ষার আগে ডিম এড়িয়ে চলে।",
    category: "শিক্ষা",
    image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=600",
    isSlider: false
  },
  {
    title: "দাঁত পড়লে ইঁদুরের গর্তে ফেলা",
    description: "দাঁত ইঁদুরের গর্তে ফেললে নাকি নতুন দাঁত ইঁদুরের দাঁতের মতো মজবুত হয়।",
    category: "শারীরিক",
    image: "https://images.unsplash.com/photo-1599687267812-35c05ff70ee9?auto=format&fit=crop&q=80&w=600",
    isSlider: false
  }
];

export default function BangladeshMythsApp() {
  const [myths, setMyths] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // ফর্ম স্টেটস
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [editingMyth, setEditingMyth] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', description: '', category: '', image: '', isSlider: false 
  });
  
  const fileInputRef = useRef(null);

  // অথেনটিকেশন
  useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error("Auth Error:", error));
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // ডাটা লোডিং
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'myths'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMyths = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (loadedMyths.length === 0 && !loading) {
        seedDatabase(); // ডাটা না থাকলে অটোমেটিক সিড হবে
      } else {
        setMyths(loadedMyths);
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setLoading(false);
      if(myths.length === 0) setMyths(INITIAL_MYTHS);
    });
    return () => unsubscribe();
  }, [user]);

  const seedDatabase = async () => {
    setLoading(true);
    const batch = writeBatch(db);
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'myths');
    INITIAL_MYTHS.forEach(myth => {
      const docRef = doc(collectionRef);
      batch.set(docRef, myth);
    });
    try { await batch.commit(); } 
    catch (e) { console.error(e); setMyths(INITIAL_MYTHS); }
    finally { setLoading(false); }
  };

  // স্লাইডার ইফেক্ট
  const sliderMyths = myths.filter(m => m.isSlider);
  useEffect(() => {
    if (sliderMyths.length === 0) return;
    const timer = setInterval(() => setCurrentSlide(p => (p + 1) % sliderMyths.length), 4000);
    return () => clearInterval(timer);
  }, [sliderMyths.length]);

  // হ্যান্ডলার্স
  const handleLogin = (e) => {
    e.preventDefault();
    if (email === "himel452@gmail.com" && password === "Bank@200") {
      setIsAdmin(true); setShowLoginModal(false); setLoginError("");
    } else {
      setLoginError("ভুল তথ্য!");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isAddingNew) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'myths'), formData);
        setIsAddingNew(false);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'myths', editingMyth), formData);
        setEditingMyth(null);
      }
      setFormData({ title: '', description: '', category: '', image: '', isSlider: false });
    } catch (e) { alert("সেভ হয়নি!"); }
  };

  const handleDelete = async (id) => {
    if (confirm("ডিলিট করবেন?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'myths', id));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const filteredMyths = myths.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* নেভিগেশন */}
      <nav className="sticky top-0 z-50 bg-white shadow-md border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 text-white p-2 rounded-lg"><Menu size={20} /></div>
            <h1 className="text-2xl font-bold text-emerald-700">বাংলার মিথ</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <input 
                type="text" placeholder="মিথ খুঁজুন..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-full focus:ring-2 focus:ring-emerald-500 w-64 text-sm"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            </div>
            <button 
              onClick={() => isAdmin ? setIsAdmin(false) : setShowLoginModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${isAdmin ? 'bg-red-50 text-red-600' : 'bg-emerald-600 text-white'}`}
            >
              {isAdmin ? <><LogOut size={16}/> লগআউট</> : <><Lock size={16}/> অ্যাডমিন</>}
            </button>
          </div>
        </div>
      </nav>

      {/* স্লাইডার */}
      {!isAddingNew && !editingMyth && sliderMyths.length > 0 && (
        <div className="relative w-full h-[400px] bg-slate-900 group">
          {sliderMyths.map((myth, idx) => (
            <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? "opacity-100" : "opacity-0"}`}>
              <img src={myth.image} alt={myth.title} className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 flex flex-col justify-end p-8">
                <h2 className="text-4xl font-bold text-white mb-2">{myth.title}</h2>
                <p className="text-slate-200">{myth.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* মেইন কন্টেন্ট */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {isAdmin && !isAddingNew && !editingMyth && (
          <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-xl mb-8 border border-emerald-100">
            <h3 className="text-emerald-800 font-bold">অ্যাডমিন ড্যাশবোর্ড</h3>
            <div className="flex gap-2">
              <button onClick={seedDatabase} className="bg-white text-emerald-600 p-2 rounded border"><RefreshCw size={18}/></button>
              <button onClick={() => {setIsAddingNew(true); setFormData({title:'', description:'', category:'', image:'', isSlider:false})}} className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={18}/> নতুন যোগ করুন</button>
            </div>
          </div>
        )}

        {/* ফর্ম */}
        {(isAddingNew || editingMyth) && (
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-3xl mx-auto mb-12 relative">
            <button onClick={() => {setIsAddingNew(false); setEditingMyth(null)}} className="absolute top-4 right-4"><X/></button>
            <h2 className="text-2xl font-bold mb-6">{isAddingNew ? "নতুন মিথ" : "মিথ এডিট"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input required placeholder="শিরোনাম" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-2 border rounded"/>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 border rounded">
                <option value="">ক্যাটাগরি বাছুন</option>
                <option>খাবার</option><option>সংসার</option><option>প্রকৃতি</option><option>শিক্ষা</option><option>শারীরিক</option>
              </select>
              <textarea required rows={3} placeholder="বিবরণ" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded"/>
              <div className="flex gap-2 items-center">
                <input type="text" placeholder="ছবির লিংক" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="flex-1 p-2 border rounded"/>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden"/>
                <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 bg-slate-100 rounded"><Upload size={18}/></button>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.isSlider} onChange={e => setFormData({...formData, isSlider: e.target.checked})} />
                <label>স্লাইডারে দেখান</label>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded font-bold"><Save size={18} className="inline mr-2"/> সেভ করুন</button>
            </form>
          </div>
        )}

        {/* গ্রিড */}
        {loading ? <div className="text-center">লোড হচ্ছে...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMyths.map((myth) => (
              <div key={myth.id} className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden group">
                <div className="relative h-48">
                  <img src={myth.image || "https://placehold.co/600x400"} alt={myth.title} className="w-full h-full object-cover"/>
                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-2">
                      <button onClick={() => {setEditingMyth(myth.id); setFormData(myth); setIsAddingNew(false)}} className="bg-white p-2 rounded-full text-blue-600"><Edit2/></button>
                      <button onClick={() => handleDelete(myth.id)} className="bg-white p-2 rounded-full text-red-600"><Trash2/></button>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{myth.title}</h3>
                  <p className="text-slate-600 text-sm line-clamp-3">{myth.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* লগইন মডাল */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white p-8 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">অ্যাডমিন লগইন</h2>
            {loginError && <p className="text-red-500 text-sm mb-2">{loginError}</p>}
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 border rounded"/>
              <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 border rounded"/>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowLoginModal(false)} className="flex-1 p-2 border rounded">বাতিল</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white p-2 rounded">লগইন</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}