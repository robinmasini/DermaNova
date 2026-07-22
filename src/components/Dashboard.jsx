import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/bg.png';
import robotImg from '../assets/robot.png';
import navbarImg from '../assets/navbar.png';

// Configuration du worker PDF.js via CDN pour éviter les problèmes de build Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function Dashboard({ onLogout, isStandalonePortal }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resultTab, setResultTab] = useState('diagnostic');
  const [selectedImages, setSelectedImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // States persistants (chargement depuis localStorage)
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('dermaNovaPatients');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, initial: 'J', name: 'Juliette R.', age: 19, email: 'juliette.r@example.com', phone: '06 12 34 56 78', date: "Aujourd'hui", status: 'En amélioration', statusClass: 'improving', history: [] }
    ];
  });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isMedicalFileOpen, setIsMedicalFileOpen] = useState(false);
  
  const [pdfs, setPdfs] = useState(() => {
    const saved = localStorage.getItem('dermaNovaPdfs');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('dermaNovaGeminiKey') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [isKeySaved, setIsKeySaved] = useState(!!(localStorage.getItem('dermaNovaGeminiKey') || import.meta.env.VITE_GEMINI_API_KEY));

  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [newPatientTab, setNewPatientTab] = useState('sms'); // 'sms' ou 'create'
  const [newPatientData, setNewPatientData] = useState({ name: '', age: '', email: '', phoneRaw: '', phoneCountry: '+33' });

  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsPhoneRaw, setSmsPhoneRaw] = useState('');
  const [smsPhoneCountry, setSmsPhoneCountry] = useState('+33');

  const PHONE_COUNTRIES = [
    { code: '+33', flag: '🇫🇷' },
    { code: '+44', flag: '🇬🇧' },
    { code: '+32', flag: '🇧🇪' },
    { code: '+31', flag: '🇳🇱' },
    { code: '+34', flag: '🇪🇸' },
    { code: '+39', flag: '🇮🇹' },
  ];

  const formatPhoneDigits = (val) => {
    const digits = val.replace(/\\D/g, '');
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && i % 2 === 0) formatted += ' ';
      formatted += digits[i];
    }
    return formatted.trim();
  };

  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const resultsRef = useRef(null);

  const openNewPatientModal = (tab = 'sms') => {
    setNewPatientTab(tab);
    setIsNewPatientModalOpen(true);
  };

  const getMockAnalysis = (isPatient) => {
    if (isPatient) {
      return {
        hydration: "Bonne (58%)",
        ph: "5.5 (Physiologique)",
        elasticity: "Souple",
        aging: "Léger (15%)",
        agingDetails: [
          { title: "Grain de peau", description: "Texture globale **homogène** avec quelques zones légères de sensibilité passagère." },
          { title: "Barrière cutanée", description: "Film hydrolipidique **bien préservé**, nécessitant un maintien hydrique quotidien." }
        ],
        diagnosis: [
          { title: "Érythème superficiel réactif", description: "Observation d'une **légère rougeur diffuse** sans gravité. La peau réagit probablement aux agressions extérieures." },
          { title: "Sensibilité cutanée", description: "Zone légèrement réactive au niveau des joues. **Aucune lésion sévère** observée." }
        ],
        recommendation: "Conservez une routine douce, apaisante et bien hydratante. Protégez votre peau du soleil.",
        treatments: [
          { title: "Sérum Apaisant & Hydratant", description: "Appliquer **matin et soir** sur visage propre. Privilégier la **Niacinamide** et l'**Acide Hyaluronique**." },
          { title: "Crème Émolliente Protectrice", description: "Appliquer après le sérum pour sceller l'hydratation." },
          { title: "Écran Solaire SPF 50+", description: "Appliquer chaque matin avant toute exposition." }
        ]
      };
    } else {
      return {
        hydration: "54% (Sub-optimale)",
        ph: "5.6 (Équilibré)",
        elasticity: "Indice 0.82 (Grade I)",
        aging: "22% (Stade I)",
        agingDetails: [
          { title: "Micro-relief & Élastose", description: "Discrètes **stries de déshydratation** péri-orbitaires. Altération débutante de la matrice extracellulaire." },
          { title: "Pigmentation Tissulaire", description: "Légères **lentigines actiniques** débutantes. Vascularisation dermique superficielle réactive." }
        ],
        diagnosis: [
          { title: "Dermatite réactive & xérose modérée", description: "Examen dermatologique visuel mettant en évidence un **érythème périlésionnel** avec micro-desquamation folliculaire." }
        ],
        recommendation: "Protocole d'optimisation dermo-cosmétique ciblé avec renforcement de la fonction barrière épidermique.",
        treatments: [
          { title: "Céramides NP/AP & Acide Hyaluronique Vectorisé", description: "Application biquotidienne en couche mince pour restaurer la cimentation intercellulaire." },
          { title: "Niacinamide 5% + Acide Azélaïque 10%", description: "Application nocturne pour modulation de la micro-inflammation et homogénéisation du teint." },
          { title: "Photoprotection Large Spectre SPF 50+", description: "Protection quotidienne contre le stress oxydatif." }
        ]
      };
    }
  };

  // Sauvegarde automatique lors des changements
  useEffect(() => {
    localStorage.setItem('dermaNovaPatients', JSON.stringify(patients));
  }, [patients]);

  // Initialisation du mode portail autonome
  useEffect(() => {
    if (isStandalonePortal) {
      const params = new URLSearchParams(window.location.search);
      const pid = parseInt(params.get('patientId'));
      if (pid) {
        const found = patients.find(p => p.id === pid);
        if (found) {
          setSelectedPatient(found);
          setIsPortalOpen(true);
        } else if (patients.length > 0) {
          setSelectedPatient(patients[0]);
          setIsPortalOpen(true);
        }
      } else {
        setSelectedPatient(patients[0] || { id: 1, name: 'Patient Portail', age: 28, email: '', phone: '' });
        setIsPortalOpen(true);
      }
    }
  }, [isStandalonePortal, patients]);

  useEffect(() => {
    localStorage.setItem('dermaNovaPdfs', JSON.stringify(pdfs));
  }, [pdfs]);

  const saveGeminiKey = () => {
    localStorage.setItem('dermaNovaGeminiKey', geminiKey);
    setIsKeySaved(true);
    alert("Clé Gemini sauvegardée avec succès ! L'IA est maintenant active.");
  };

  const handleImageUpload = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newImages = [];
      
      for (const file of files) {
        if (selectedImages.length + newImages.length >= 5) {
          alert("Vous ne pouvez importer que 5 photos maximum.");
          break;
        }
        
        const base64Url = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        
        newImages.push({
          url: base64Url,
          name: file.name,
          size: file.size
        });
      }
      
      setSelectedImages((prev) => [...prev, ...newImages].slice(0, 5));
      setAnalysisResult(null);
    }
  };

  const removeImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    if (selectedImages.length <= 1) {
      setAnalysisResult(null); // Clear analysis if no images remain
    }
  };

  const renderTextWithBold = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{color: '#fff'}}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      // On lit au maximum les 10 premières pages pour ne pas saturer la mémoire locale du navigateur
      const numPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(" ") + " ";
      }
      return fullText;
    } catch (e) {
      console.error("Erreur lors de la lecture du PDF", e);
      return "Erreur d'extraction du texte.";
    }
  };

  const handlePdfUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsPdfUploading(true);
      
      const extractedText = await extractTextFromPDF(file);
      
      const newPdf = {
        id: Date.now(),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        type: "Document médical",
        status: "Intégré à 100%",
        date: "À l'instant",
        // On tronque à 50 000 caractères pour ne pas exploser le localStorage (environ 50ko)
        content: extractedText.substring(0, 50000) 
      };
      
      setPdfs([newPdf, ...pdfs]);
      setIsPdfUploading(false);
    }
  };

  const handleAddPatient = (e) => {
    e.preventDefault();
    if (!newPatientData.name) return;
    
    const newHistoryEntry = analysisResult ? [{
      date: new Date().toLocaleDateString(),
      images: selectedImages,
      analysis: analysisResult
    }] : [];

    const newPatient = {
      id: Date.now(),
      initial: newPatientData.name.charAt(0).toUpperCase(),
      name: newPatientData.name,
      age: newPatientData.age || 0,
      email: newPatientData.email || 'Non renseigné',
      phone: newPatientData.phoneRaw ? `${newPatientData.phoneCountry} ${newPatientData.phoneRaw}` : 'Non renseigné',
      date: "À l'instant",
      status: "Nouveau dossier",
      statusClass: "stable",
      portalLink: `https://dermanova.app/p/${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      history: newHistoryEntry
    };
    
    const updatedPatients = [newPatient, ...patients];
    setPatients(updatedPatients);
    
    // Si on a sauvegardé une analyse en cours, on l'attache et on vide le dashboard
    if (analysisResult) {
      setSelectedImages([]);
      setAnalysisResult(null);
      alert('Analyse sauvegardée dans la nouvelle fiche patient !');
      setActiveTab('patients');
      setSelectedPatient(newPatient);
    }
    
    setIsNewPatientModalOpen(false);
    setNewPatientData({ name: '', age: '', email: '', phoneRaw: '', phoneCountry: '+33' });
  };

  const handleSaveToExistingPatient = (patientIdStr) => {
    const patientId = parseInt(patientIdStr);
    const patientIndex = patients.findIndex(p => p.id === patientId);
    if (patientIndex === -1) return;
    
    const patient = patients[patientIndex];
    const newHistoryEntry = {
      date: new Date().toLocaleDateString(),
      images: selectedImages,
      analysis: analysisResult
    };
    
    const updatedPatient = {
      ...patient,
      date: "À l'instant",
      history: [newHistoryEntry, ...(patient.history || [])]
    };
    
    const updatedPatients = [...patients];
    updatedPatients[patientIndex] = updatedPatient;
    
    setPatients(updatedPatients);
    
    setSelectedImages([]);
    setAnalysisResult(null);
    alert(`Analyse ajoutée au dossier de ${patient.name} !`);
    setActiveTab('patients');
    setSelectedPatient(updatedPatient);
    setIsNewPatientModalOpen(false);
  };

  const handleDeletePatient = (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce patient de votre base ?')) {
      const updated = patients.filter(p => p.id !== id);
      setPatients(updated);
      if (selectedPatient?.id === id) setSelectedPatient(null);
    }
  };

  const handleSmsPhoneChange = (e) => {
    setSmsPhoneRaw(formatPhoneDigits(e.target.value));
  };

  const handleSendSms = (e) => {
    e.preventDefault();
    const cleanPhone = smsPhoneRaw.replace(/\s/g, '');
    if (cleanPhone.length < 9) return;
    alert(`Un SMS contenant le lien du portail patient a été envoyé au ${smsPhoneCountry} ${smsPhoneRaw}.`);
    setIsSmsModalOpen(false);
    setIsNewPatientModalOpen(false);
    setSmsPhoneRaw('');
    setSmsPhoneCountry('+33');
  };

  const startAnalysis = async () => {
    if (selectedImages.length === 0) {
      alert("Veuillez d'abord importer au moins une photo.");
      return;
    }
    
    setAnalysisResult(null);
    setResultTab('diagnostic');
    setIsAnalyzing(true);

    const isPatient = isStandalonePortal || isPortalOpen;

    if (!geminiKey) {
      // Simulation fluide si aucune clé n'est configurée (portail patient / démo local)
      setTimeout(() => {
        const mockRes = getMockAnalysis(isPatient);
        setAnalysisResult(mockRes);
        setIsAnalyzing(false);
        setTimeout(() => {
          if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }, 1500);
      return;
    }
    
    try {
      // 1. Construire le contexte PDF
      let pdfContext = "";
      if (pdfs.length > 0) {
        pdfContext = "Voici des extraits des ouvrages médicaux de référence fournis par le praticien. BASE TES CONCLUSIONS SUR CES OUVRAGES :\n\n" + 
          pdfs.map(p => `--- OUVRAGE: ${p.name} ---\n${p.content}`).join("\n\n");
      }

      const promptText = isPatient
        ? `Tu es l'assistant IA du cabinet de dermatologie, et tu t'adresses directement au patient de manière rassurante, bienveillante et avec un vocabulaire vulgarisé, tout en gardant une expertise médicale basée sur les documents fournis.
Analyse cette image dermatologique du patient et explique tes observations de manière claire et simple pour un novice.
Base-toi EXCLUSIVEMENT sur les connaissances des ouvrages/documents PDF fournis ci-dessous si elles sont pertinentes.

Le diagnostic doit expliquer l'origine possible du problème en termes simples, et les traitements proposés doivent être présentés comme une recommandation de protocole (crèmes, hygiène de vie, etc.) tout en précisant que le médecin devra valider.

Contexte PDF:
${pdfContext}

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure. 
ATTENTION: Pour les champs 'hydration', 'ph', 'elasticity' et 'aging', renvoie une valeur très courte et compréhensible (ex: "Bonne", "Normal", "Légère baisse").
En revanche, pour 'agingDetails', 'diagnosis' et 'treatments', explique de manière simplifiée et vulgarisée, avec des mots rassurants.
CRUCIAL: Structure tes réponses sous forme de listes d'objets avec un 'title' et une 'description'. Mets les mots-clés en gras.
TRÈS IMPORTANT: NE METS AUCUN RETOUR À LA LIGNE (\n) NI CARACTÈRE DE CONTRÔLE DANS LES VALEURS DE TEXTE. N'UTILISE JAMAIS DE GUILLEMETS DOUBLES (") À L'INTÉRIEUR DES TEXTES (utilise des guillemets simples à la place). LE JSON DOIT ÊTRE STRICTEMENT VALIDE.
{
  "hydration": "Valeur courte estimée",
  "ph": "Valeur courte estimée",
  "elasticity": "Valeur courte estimée",
  "aging": "Valeur courte",
  "agingDetails": [ { "title": "...", "description": "..." } ],
  "diagnosis": [ { "title": "...", "description": "..." } ],
  "recommendation": "Recommandation générale rassurante",
  "treatments": [ { "title": "...", "description": "..." } ]
}`
        : `Tu es un expert dermatologue mondialement reconnu.
Analyse cette image dermatologique du patient avec la plus grande précision clinique.
Base-toi EXCLUSIVEMENT sur les connaissances des ouvrages/documents PDF fournis ci-dessous si elles sont pertinentes. N'hésite pas à citer le nom de l'ouvrage sur lequel tu t'appuies.

Je veux une analyse extrêmement approfondie, détaillée et technique pour le diagnostic et les traitements. Ne te contente pas de descriptions superficielles.
Le diagnostic doit expliquer l'étiologie possible, et les traitements doivent être un protocole clinique complet, étape par étape, incluant molécules actives, dosages ou techniques médicales (laser, peeling, etc.) justifiés.

Contexte PDF:
${pdfContext}

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure. 
ATTENTION: Pour les champs 'hydration', 'ph', 'elasticity' et 'aging', tu DOIS renvoyer une valeur très courte (ex: "45%", "5.5", "Moyenne", "30%"). Même si c'est difficile à évaluer sur photo, fais une déduction clinique experte et donne TOUJOURS une valeur estimée réaliste. Ne dis JAMAIS que c'est non mesurable ou "N/A". Ne mets JAMAIS de longues phrases dans ces champs.
En revanche, pour éviter les gros blocs de texte indigestes, structure tes réponses pour 'agingDetails', 'diagnosis' et 'treatments' sous forme de listes d'objets avec un 'title' (titre clair et concis) et une 'description' (explication détaillée). 
CRUCIAL: Dans les descriptions, mets **BEAUCOUP DE MOTS EN GRAS** (en les entourant de doubles astérisques **) pour mettre en valeur les mots-clés, les symptômes et les molécules, afin de faciliter la lecture en diagonale ! 
TRÈS IMPORTANT: NE METS AUCUN RETOUR À LA LIGNE (\n) NI CARACTÈRE DE CONTRÔLE DANS LES VALEURS DE TEXTE. N'UTILISE JAMAIS DE GUILLEMETS DOUBLES (") À L'INTÉRIEUR DES TEXTES (utilise des guillemets simples à la place). LE JSON DOIT ÊTRE STRICTEMENT VALIDE.
{
  "hydration": "Valeur courte estimée (ex: 45%)",
  "ph": "Valeur courte estimée (ex: 5.5)",
  "elasticity": "Score clinique estimé (ex: Grade I ou Indice 0.8)",
  "aging": "Valeur courte (ex: 30%)",
  "agingDetails": [
    { "title": "Nom du signe", "description": "Explication hyper détaillée, très longue et exhaustive de la physiopathologie et des observations." }
  ],
  "diagnosis": [
    { "title": "Titre du constat", "description": "Développement clinique très long et argumenté." }
  ],
  "recommendation": "Recommandation générale détaillée",
  "treatments": [
    { "title": "Nom du protocole", "description": "Protocole extrêmement précis, très long, détaillant la posologie, le mécanisme d'action et les étapes." }
  ]
}`;

      // 2. Initialiser Gemini
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      // 3. Préparer toutes les images en Base64
      const imageParts = await Promise.all(selectedImages.map(async (img) => {
        const responseImg = await fetch(img.url);
        const blob = await responseImg.blob();
        const base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
        return { inlineData: { data: base64data, mimeType: blob.type } };
      }));

      // 4. Appel à l'API Gemini 2.5 Flash avec images multiples
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          promptText,
          ...imageParts
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hydration: { type: Type.STRING },
              ph: { type: Type.STRING },
              elasticity: { type: Type.STRING },
              aging: { type: Type.STRING },
              agingDetails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }
                }
              },
              diagnosis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }
                }
              },
              recommendation: { type: Type.STRING },
              treatments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }
                }
              }
            }
          }
        }
      });

      let resultText = response.text;
      
      let parsedJSON;
      try {
        parsedJSON = JSON.parse(resultText);
      } catch (parseError) {
        console.warn("JSON.parse failed initially, attempting cleanup:", parseError);
        resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
        resultText = resultText.replace(/[\u0000-\u001F]+/g, ' ');
        parsedJSON = JSON.parse(resultText);
      }
      
      setAnalysisResult(parsedJSON);
      
    } catch (error) {
      console.warn("Analyse IA Gemini indisponible, bascule sur le moteur dermatologique local:", error);
      const mockRes = getMockAnalysis(isPatient);
      setAnalysisResult(mockRes);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'patients', label: 'Liste Patients' },
    { id: 'pdf_knowledge', label: 'Connaissances PDF' },
    { id: 'settings', label: 'Paramètres' },
  ];

  const renderScannerCard = () => (
    <div className="unified-scanner-card animate-fade-in">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h2>ANALYSE <span className="brand-light">DERMATOLOGIQUE</span></h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <p className="card-description" style={{ marginBottom: 0 }}>
          Importez ou prenez une photo directe. L'IA croisera les données visuelles avec vos documents PDF intégrés.
        </p>
        {!(isStandalonePortal || isPortalOpen) && (
          <button className="btn-primary-clean" onClick={() => openNewPatientModal('sms')} style={{ padding: '0.6rem 1.2rem', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '8px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nouveau(elle) patient(e)
          </button>
        )}
      </div>
      
      <div className={`scanner-body ${selectedImages.length > 0 ? 'has-photo' : 'no-photo'} ${isAnalyzing || analysisResult ? 'has-results' : ''}`}>
        {selectedImages.length === 0 && (
          <div className="upload-column glass-panel desktop-only">
            <div className="upload-container compact" onClick={() => fileInputRef.current.click()}>
              <div className="upload-placeholder">
                <div className="upload-icon-ring">
                  <span className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </span>
                </div>
                <h3>Photo</h3>
                <span className="upload-subtext">Caméra ou Galerie</span>
              </div>
            </div>
          </div>
        )}
        
        <div className={`robot-side glass-panel ${isAnalyzing ? 'scanning-active' : ''}`}>
          <img src={robotImg} alt="DermaNova Assistant Robot" className={`robot-image ${isAnalyzing ? 'floating' : ''}`} />
          
          <div className="robot-actions-container">
            {selectedImages.length > 0 && (
              <div className="thumbnails-row">
                {selectedImages.map((img, index) => (
                  <div key={index} className="thumbnail-wrapper">
                    <button className="remove-thumbnail-btn" onClick={(e) => { e.stopPropagation(); removeImage(index); }}>✕</button>
                    <img src={img.url} alt={`Photo ${index + 1}`} className="thumbnail-image" />
                    {isAnalyzing && <div className="scan-laser-small"></div>}
                  </div>
                ))}
              </div>
            )}
            
            <div className="action-row" style={{ width: '100%' }}>
              {(selectedImages.length < 5) && (
                <div className={`small-upload ${selectedImages.length === 0 ? 'desktop-hidden' : ''}`} onClick={() => fileInputRef.current.click()}>
                  <div className="upload-placeholder-small">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    <span>Photo</span>
                  </div>
                </div>
              )}
              <button 
                className={`start-analysis-btn ${isAnalyzing ? 'analyzing' : ''} ${analysisResult ? 'success' : ''}`} 
                onClick={startAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "ANALYSE EN COURS..." : analysisResult ? "NOUVELLE ANALYSE" : "DÉMARRER L'ANALYSE"}
              </button>
              
              {/* Invisible spacer to balance the small-upload icon and perfectly center the button */}
              {(selectedImages.length < 5) && (
                <div className={`small-upload ${selectedImages.length === 0 ? 'desktop-hidden' : ''}`} style={{ visibility: 'hidden' }}></div>
              )}
            </div>
          </div>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            multiple
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleImageUpload} 
          />
        </div>

        <div className="dashboard-cta-container" style={{ position: 'relative' }}>
          <img src="/cta.png" alt="DermaNova CTA" style={{ width: '100%', display: 'block' }} />
          <a 
            href="/?portal=true" 
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '5%',
              width: '35%',
              height: '25%',
              cursor: 'pointer',
              display: 'block',
              zIndex: 10
            }}
            title="Allons-y !"
          ></a>
        </div>

        {(isAnalyzing || analysisResult) && (
          <div className={`results-column glass-panel`} ref={resultsRef}>
            {isAnalyzing ? (
              <div className="analyzing-state">
                <div className="spinner"></div>
                <p className="scanning-text">Analyse multimodale IA en cours...</p>
              </div>
            ) : analysisResult ? (
              <div className="analysis-results animate-fade-in">
              <div className="result-tabs">
                <button 
                  className={`result-tab ${resultTab === 'diagnostic' ? 'active' : ''}`}
                  onClick={() => setResultTab('diagnostic')}
                >
                  DIAGNOSTIC
                </button>
                <button 
                  className={`result-tab ${resultTab === 'traitement' ? 'active' : ''}`}
                  onClick={() => setResultTab('traitement')}
                >
                  TRAITEMENT
                </button>
              </div>

              {resultTab === 'diagnostic' && (
                <div className="tab-content animate-fade-in">
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-icon" style={{marginBottom: '0.8rem', color: 'var(--accent-cyan)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                      </div>
                      <span className="metric-label">HYDRATATION</span>
                      <span className="metric-value">{analysisResult.hydration}</span>
                    </div>
                    <div className="metric-box">
                      <div className="metric-icon" style={{marginBottom: '0.8rem', color: 'var(--accent-teal)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H15M10 9H14M3 21H21M7 21V5C7 4.44772 7.44772 4 8 4H16C16.5523 4 17 4.44772 17 5V21"></path></svg>
                      </div>
                      <span className="metric-label">PH DERMIQUE</span>
                      <span className="metric-value">{analysisResult.ph}</span>
                    </div>
                    <div className="metric-box">
                      <div className="metric-icon" style={{marginBottom: '0.8rem', color: 'var(--accent-purple)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="6.5"></line></svg>
                      </div>
                      <span className="metric-label">SÉBUM</span>
                      <span className="metric-value">{analysisResult.sebum}</span>
                    </div>
                    <div className="metric-box">
                      <div className="metric-icon" style={{marginBottom: '0.8rem', color: 'var(--accent-gold)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                      </div>
                      <span className="metric-label">ÉRYTHÈME</span>
                      <span className="metric-value">{analysisResult.erythema}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>ANALYSE DU VIEILLISSEMENT</h4>
                    <div className="aging-stats">
                      <div className="aging-stat">
                        <span>Âge estimé (IA)</span>
                        <strong>{analysisResult.estimatedAge} ans</strong>
                      </div>
                      <div className="aging-stat" style={{textAlign: 'right'}}>
                        <span>Âge réel</span>
                        <strong>{analysisResult.realAge} ans</strong>
                      </div>
                    </div>
                    <div className="structured-content">
                      {Array.isArray(analysisResult.agingDetails) ? analysisResult.agingDetails.map((item, idx) => (
                        <div key={idx} className="structured-item">
                          <span className="structured-title">{item.title}</span>
                          <p>{renderTextWithBold(item.description)}</p>
                        </div>
                      )) : <p className="aging-details">{renderTextWithBold(analysisResult.agingDetails)}</p>}
                    </div>
                  </div>

                  <div className="ai-diagnosis">
                    <h4>DIAGNOSTIC IA</h4>
                    <div className="structured-content">
                      {Array.isArray(analysisResult.diagnosis) ? analysisResult.diagnosis.map((item, idx) => (
                        <div key={idx} className="structured-item">
                          <span className="structured-title">{item.title}</span>
                          <p>{renderTextWithBold(item.description)}</p>
                        </div>
                      )) : <p>{renderTextWithBold(analysisResult.diagnosis)}</p>}
                    </div>
                  </div>
                </div>
              )}

              {resultTab === 'traitement' && (
                <div className="tab-content animate-fade-in">
                  <div className="ai-diagnosis">
                    <h4>RECOMMANDATION GLOBALE</h4>
                    <p>{renderTextWithBold(analysisResult.recommendation)}</p>
                  </div>
                  <div className="treatment-details">
                    <h4>PROTOCOLES CLINIQUES</h4>
                    <div className="structured-content">
                      {Array.isArray(analysisResult.treatments) ? analysisResult.treatments.map((item, idx) => (
                        <div key={idx} className="structured-item">
                          <span className="structured-title">{item.title || item}</span>
                          {item.description && <p>{renderTextWithBold(item.description)}</p>}
                        </div>
                      )) : <ul>{analysisResult.treatments.map((t, idx) => <li key={idx}>{renderTextWithBold(t)}</li>)}</ul>}
                    </div>
                  </div>
                  
                  <button 
                    className="start-analysis-btn" 
                    style={{marginTop: '1rem', background: 'transparent', border: '1px solid #ffffff', color: '#ffffff'}} 
                    onClick={() => setIsNewPatientModalOpen(true)}
                  >
                    SAUVEGARDER L'ANALYSE DANS UN DOSSIER PATIENT
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
        )}
      </div>
    </div>
  );


  const renderMedicalFile = () => {
    if (!selectedPatient) return null;
    return (
      <div className="medical-file-fullscreen animate-fade-in" style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', minHeight: '100%' }}>
          
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button 
                onClick={() => setIsMedicalFileOpen(false)}
                className="btn-secondary-clean" 
                style={{ padding: '0.6rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Retour
              </button>
              <div>
                <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--text-light)' }}>{selectedPatient.name}</h1>
                <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)' }}>
                  <span><strong style={{color: 'var(--text-light)'}}>ID:</strong> #{selectedPatient.id}</span>
                  <span><strong style={{color: 'var(--text-light)'}}>Âge:</strong> {selectedPatient.age || 34} ans</span>
                </div>
              </div>
            </div>
            <button className="btn-primary-clean">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Modifier
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            
            {/* COLONNE GAUCHE: CONTACT ET INFO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="info-box-clean">
                <div className="info-label">Contact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    {selectedPatient.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    {selectedPatient.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    14 Avenue des Champs, Paris
                  </div>
                </div>
              </div>

              <div className="info-box-clean">
                <div className="info-label">Suivi Dermatologique Actuel</div>
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-light)' }}><strong>Dernier diagnostic:</strong> Acné Sévère</p>
                  <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-light)' }}><strong>Étape:</strong> Traitement J-0</p>
                  <p style={{ margin: '0', color: 'var(--text-light)' }}><strong>Médecin référent:</strong> Dr. MASINI</p>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE: HISTORIQUE ET TRAITEMENTS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Traitement en cours</h3>
                <div className="exchange-item-clean">
                  <div className="exchange-icon" style={{ background: 'rgba(255,193,7,0.1)', color: '#ffc107' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                  <div className="exchange-details">
                    <div className="exchange-title">
                      <strong>Curacné 20mg / jour</strong>
                      <span className="exchange-date">Prescrit le 10/05/2026</span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                      Poursuivre le traitement hydratant le soir. Rendez-vous de suivi dans 3 mois pour ajustement posologique.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Historique des analyses IA</h3>
                {selectedPatient.history && selectedPatient.history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedPatient.history.map((h, i) => (
                      <div key={i} className="info-box-clean" style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', alignItems: 'center' }}>
                        {h.image ? (
                          <img src={h.image} alt="Analyse" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                        ) : (
                          <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--accent-cyan)' }}>Analyse du {h.date}</h4>
                          <p style={{ margin: '0', color: 'var(--text-light)', fontSize: '0.9rem' }}>{h.notes || h.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-box-clean">
                    Aucune analyse IA enregistrée pour ce patient.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const renderPatientsList = () => {
    const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
    <div className="patients-tab animate-fade-in">
      <div className="tab-header">
        <div>
          <h2>Base Patients</h2>
          <p>Gérez vos dossiers médicaux</p>
        </div>
      </div>
      
      <div className="patients-layout">
        {isMedicalFileOpen ? (
          renderMedicalFile()
        ) : (
          <>
            <div className="patient-list-column clean-table-panel">
          <div className="table-top-bar">
            <div className="table-title">
              <h2>Liste des patients</h2>
              <span className="patient-count">{filteredPatients.length} patient(s)</span>
            </div>
            
            <div className="table-actions">
              <div className="search-wrapper">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Rechercher un patient..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="patient-search-input-clean"
                />
              </div>
              <button className="filter-btn">Filtre : plus récent</button>
              <button className="btn-primary-clean" onClick={() => openNewPatientModal('sms')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Nouveau(elle) patient(e)
              </button>
            </div>
          </div>

          <div className="table-header-row">
            <div className="col-patient">PATIENT</div>
            <div className="col-retour">RETOURS PATIENT</div>
            <div className="col-etape">ÉTAPE</div>
            <div className="col-sms">SMS ENVOYÉ</div>
          </div>

          <div className="patient-scroll-area clean">
            {filteredPatients.map(patient => (
              <div key={patient.id} className={`patient-row ${selectedPatient?.id === patient.id ? 'active' : ''}`} onClick={() => setSelectedPatient(patient)}>
                <div className="col-patient">
                  <div className="patient-avatar-clean">{patient.initial}</div>
                  <span className="patient-name-clean">{patient.name}</span>
                </div>
                <div className="col-retour">
                  <span className="badge-warning">Bilan en attente</span>
                </div>
                <div className="col-etape">
                  <span className="text-success">J-0</span>
                </div>
                <div className="col-sms">
                  <span className="sms-status-text">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Lien envoyé
                  </span>
                </div>
              </div>
            ))}
            {filteredPatients.length === 0 && <p className="empty-table-msg">Aucun patient trouvé.</p>}
          </div>
        </div>

      {/* PANNEAU LATÉRAL (DRAWER) CONFINED TO RIGHT COLUMN */}
      <div 
        className={`patient-drawer-container ${!selectedPatient ? 'is-empty' : ''}`}
        style={!selectedPatient && window.innerWidth <= 1000 ? { display: 'none' } : {}}
      >
        {selectedPatient ? (
          <div className="patient-drawer-desktop clean-drawer animate-slide-in-right">
            <div className="drawer-header-clean">
              <div className="drawer-title-row">
                <h2>{selectedPatient.name}</h2>
                <span className="lang-badge">FR</span>
              </div>
              <div className="drawer-actions-top">
                <button className="icon-btn" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                <button className="icon-btn text-danger" title="Supprimer" onClick={() => handleDeletePatient(selectedPatient.id)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                <button className="icon-btn" onClick={() => setSelectedPatient(null)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
              </div>
            </div>
            <div className="drawer-subtitle-clean">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Dernière consultation le {selectedPatient.date}
            </div>

            <div className="drawer-actions-block">
              <button className="btn-primary-clean" onClick={() => setIsMedicalFileOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Accéder au dossier médical
              </button>
              <button className="btn-secondary-clean" onClick={() => window.open(`/?portal=true&patientId=${selectedPatient.id}`, '_blank')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                Ouvrir Portail Patient
              </button>
              <div className="link-copy-row">
                <span>Lien direct patient</span>
                <button className="btn-copy-clean">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copier
                </button>
              </div>
            </div>

            <div className="drawer-section-clean">
              <h3>SUIVI DERMATOLOGIQUE</h3>
              <div className="grid-2-col">
                <div className="info-box-clean">
                  <span className="info-label">ÉTAPE</span>
                  <span className="info-value">J-0</span>
                </div>
                <div className="info-box-clean">
                  <span className="info-label">DERNIER BILAN</span>
                  <span className="info-value">
                    {selectedPatient.history && selectedPatient.history[0]?.analysis?.diagnosis 
                      ? (Array.isArray(selectedPatient.history[0].analysis.diagnosis) ? selectedPatient.history[0].analysis.diagnosis[0].title : "Acné")
                      : "Non renseigné"}
                  </span>
                </div>
              </div>
              <div className="info-box-clean full-width mt-2">
                <span className="info-label">TRAITEMENT EN COURS</span>
                <span className="info-value">
                  {selectedPatient.history && selectedPatient.history[0]?.analysis?.treatments 
                    ? "Routine active"
                    : "Non renseigné"}
                </span>
              </div>
            </div>

            <div className="drawer-section-clean">
              <div className="section-header-row">
                <h3>PROCHAINS RAPPELS</h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <div className="empty-box-clean">
                Aucun rappel planifié
              </div>
            </div>

            <div className="drawer-section-clean">
              <div className="section-header-row">
                <h3>DERNIERS ÉCHANGES</h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div className="exchange-item-clean">
                <div className="exchange-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div className="exchange-details">
                  <div className="exchange-title">
                    <strong>SMS patient_portal</strong>
                    <span className="status-envoye">ENVOYÉ</span>
                  </div>
                  <span className="exchange-date">Aujourd'hui, 10:45</span>
                </div>
              </div>
            </div>

            <div className="drawer-bottom-actions">
              <button className="btn-bottom">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Appeler
              </button>
              <button className="btn-bottom">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                SMS
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-patient-state" style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center'}}>
            <p>Sélectionnez un patient à gauche pour afficher sa fiche détaillée.</p>
          </div>
        )}
            </div> {/* Closes patient-drawer-container */}
          </>
        )}
      </div> {/* Closes patients-layout */}
    </div>
    );
  };

  const renderPatientPortal = () => {
    const activePatient = selectedPatient || (patients.length > 0 ? patients[0] : { id: 1, name: 'Patient' });
    return (
      <div className="patient-portal-fullscreen animate-fade-in" style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
        backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 3000, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '1rem 0'
      }}>
        <div className="dashboard-overlay"></div>
        <div style={{position: 'relative', zIndex: 10, width: '100%', maxWidth: '480px', padding: '0 1rem', paddingTop: '1rem'}}>
          {renderScannerCard()}
        </div>
      </div>
    );
  };


  const renderPdfKnowledge = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header">
        <h2>CONNAISSANCES <span className="brand-light">PDF & IA</span></h2>
      </div>
      <p className="card-description">
        Importez vos ouvrages. L'IA va réellement les lire (extraction de texte) et s'en servir comme base de vérité pour chaque diagnostic.
      </p>

      <div className="pdf-knowledge-layout">
        <div className="pdf-upload-section glass-panel-glow" onClick={() => pdfInputRef.current.click()}>
          <div className="upload-icon-ring pdf-icon">
            <span className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </span>
          </div>
          <h3>Importer un Ouvrage (PDF)</h3>
          <p>Extraction intelligente du texte par l'IA</p>
          <input 
            type="file" 
            accept=".pdf" 
            ref={pdfInputRef} 
            style={{ display: 'none' }} 
            onChange={handlePdfUpload} 
          />
          {isPdfUploading && <p className="uploading-text">Lecture et extraction du PDF en cours...</p>}
        </div>

        <div className="pdf-library">
          <h3>Ouvrages stockés en mémoire locale</h3>
          <ul className="library-list">
            {pdfs.map(pdf => (
              <li key={pdf.id} className="library-item glass-panel">
                <span className="book-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </span>
                <div className="book-info">
                  <h4>{pdf.name}</h4>
                  <span>{pdf.size} • Intégré ({(pdf.content.length / 1024).toFixed(1)} KB lu)</span>
                </div>
                <button className="logout-btn-text" style={{margin:0, color:'#ff6b6b'}} onClick={() => setPdfs(pdfs.filter(p => p.id !== pdf.id))}>Supprimer</button>
              </li>
            ))}
            {pdfs.length === 0 && <p style={{opacity: 0.5}}>Aucun PDF en mémoire.</p>}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-panel content-card animate-fade-in">
      <div className="card-header">
        <h2>PARAMÈTRES <span className="brand-light">SYSTÈME & IA</span></h2>
      </div>
      <p className="card-description">
        Configurez votre clinique et connectez le moteur d'Intelligence Artificielle.
      </p>

      <div className="settings-grid">
        <div className="setting-group glass-panel" style={{gridColumn: '1 / -1'}}>
          <h3>Configuration du Cerveau IA (Gemini)</h3>
          <p style={{fontSize: '0.85rem', color: '#ccc', marginBottom: '1rem'}}>
            Pour que DermaNova puisse analyser visuellement les photos et comprendre vos PDF, une clé API Google Gemini est requise.
          </p>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <input 
              type="password" 
              placeholder="Collez votre clé API Gemini ici (AIzaSy...)" 
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              style={{
                flexGrow: 1, padding: '0.8rem 1rem', borderRadius: '12px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', 
                color: '#fff', outline: 'none'
              }}
            />
            <button className="premium-btn-small" style={{background: '#ffffff', color: '#000'}} onClick={saveGeminiKey}>
              {isKeySaved ? "✓ Clé Sauvegardée" : "Enregistrer la clé"}
            </button>
          </div>
        </div>

        <div className="setting-group glass-panel">
          <h3>Préférences de l'Assistant</h3>
          <label className="setting-toggle">
            <span>Forcer le croisement avec les PDF</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>

        <div className="setting-group glass-panel">
          <h3>Interface & Compte</h3>
          <div className="setting-action">
            <span>Clinique : Institut Dermatologique de Paris</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isStandalonePortal) {
    return renderPatientPortal();
  }

  return (
    <div className="dashboard-container" style={{ backgroundImage: `url(${bgImage})` }}>
      {isPortalOpen && selectedPatient && renderPatientPortal()}
      <div className="dashboard-overlay"></div>
      
      <div className="dashboard-layout">
        
        {/* Sidebar à gauche */}
        <aside className="main-sidebar glass-panel">
          <div className="sidebar-logo-container">
            <div className="sidebar-logo-wrapper">
              <img src={logo} alt="DermaNova Logo" className="sidebar-logo" />
            </div>
          </div>
          
          <nav className="sidebar-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile-card">
              <div className="profile-header">
                <div className="user-avatar-placeholder">D</div>
                <div className="user-info">
                  <span className="user-name">Dr. Desouches</span>
                  <span className="user-role role-badge">Dermatologue</span>
                </div>
              </div>
            </div>
            <button className="standalone-logout-btn" onClick={onLogout}>
              Se déconnecter
            </button>
          </div>
        </aside>

        {/* Navbar Mobile (remplace sidebar sur mobile) */}
        <nav className="mobile-navbar" style={{ '--nav-bg': `url(${navbarImg})` }}>
          <div 
            className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          ></div>
          <div 
            className={`mobile-nav-item ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          ></div>
          <div 
            className="mobile-nav-item"
            onClick={() => openNewPatientModal('sms')}
            title="Nouveau(elle) patient(e)"
          ></div>
          <div 
            className={`mobile-nav-item ${activeTab === 'pdf_knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf_knowledge')}
          ></div>
          <div 
            className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          ></div>
        </nav>

        {/* Contenu principal */}
        <div className="dashboard-content">
          <main className="dashboard-main full-height">
            {activeTab === 'dashboard' && (
              <div className="dashboard-grid layout-single" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: 'auto', minHeight: '100%', paddingTop: '1rem', paddingBottom: '2rem' }}>
                {renderScannerCard()}
              </div>
            )}
            
            {activeTab === 'patients' && (
              <div className="layout-single">
                {renderPatientsList()}
              </div>
            )}

            {activeTab === 'pdf_knowledge' && (
              <div className="layout-single">
                {renderPdfKnowledge()}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="layout-single">
                {renderSettings()}
              </div>
            )}
          </main>
        </div>
        
      </div>

      {/* Modal Nouveau Patient Unifié */}
      {(isNewPatientModalOpen || isSmsModalOpen) && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content unified-modal-clean">
            <div className="modal-header-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
              <button 
                type="button"
                className={`modal-tab-btn ${newPatientTab === 'sms' ? 'active' : ''}`}
                onClick={() => setNewPatientTab('sms')}
                style={{
                  flex: 1, padding: '0.8rem', border: 'none', background: newPatientTab === 'sms' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: newPatientTab === 'sms' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: '700', cursor: 'pointer',
                  borderBottom: newPatientTab === 'sms' ? '2px solid var(--accent-cyan)' : '2px solid transparent'
                }}
              >
                1. Inviter par SMS
              </button>
              <button 
                type="button"
                className={`modal-tab-btn ${newPatientTab === 'create' ? 'active' : ''}`}
                onClick={() => setNewPatientTab('create')}
                style={{
                  flex: 1, padding: '0.8rem', border: 'none', background: newPatientTab === 'create' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: newPatientTab === 'create' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: '700', cursor: 'pointer',
                  borderBottom: newPatientTab === 'create' ? '2px solid var(--accent-cyan)' : '2px solid transparent'
                }}
              >
                2. Créer une Fiche
              </button>
            </div>

            {newPatientTab === 'sms' ? (
              <div className="modal-tab-body">
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Inviter un(e) nouveau(elle) patient(e)</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Un SMS lui sera envoyé contenant le lien sécurisé vers son portail de diagnostic dermatologique autonome.
                </p>
                <form onSubmit={handleSendSms} className="modal-form">
                  <div className="phone-input-group">
                    <select 
                      className="phone-country-select" 
                      value={smsPhoneCountry}
                      onChange={(e) => setSmsPhoneCountry(e.target.value)}
                    >
                      {PHONE_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input 
                      type="tel" 
                      placeholder="6 12 34 56 78" 
                      value={smsPhoneRaw}
                      onChange={handleSmsPhoneChange}
                      autoFocus
                      required
                    />
                  </div>
                  <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn-cancel" onClick={() => { setIsNewPatientModalOpen(false); setIsSmsModalOpen(false); }}>Annuler</button>
                    <button type="submit" className="btn-submit" style={{ flex: 1 }}>Envoyer le lien par SMS</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="modal-tab-body">
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Créer / Associer un dossier patient</h3>
                {analysisResult && patients.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                    <h4 style={{ color: 'var(--text-light)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ajouter l'analyse à un patient existant :</h4>
                    <select 
                      className="modal-select"
                      onChange={(e) => handleSaveToExistingPatient(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>Sélectionnez un patient...</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                
                <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                  {analysisResult ? 'Ou enregistrer un nouveau dossier :' : 'Formulaire nouveau patient :'}
                </h4>
                <form onSubmit={handleAddPatient} className="modal-form">
                  <input 
                    type="text" 
                    placeholder="Nom complet (ex: Jean Dupont)" 
                    value={newPatientData.name}
                    onChange={e => setNewPatientData({...newPatientData, name: e.target.value})}
                    autoFocus
                    required
                  />
                  <input 
                    type="number" 
                    placeholder="Âge" 
                    value={newPatientData.age}
                    onChange={e => setNewPatientData({...newPatientData, age: e.target.value})}
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Adresse Email" 
                    value={newPatientData.email}
                    onChange={e => setNewPatientData({...newPatientData, email: e.target.value})}
                  />
                  <div className="phone-input-group">
                    <select 
                      className="phone-country-select" 
                      value={newPatientData.phoneCountry}
                      onChange={(e) => setNewPatientData({...newPatientData, phoneCountry: e.target.value})}
                    >
                      {PHONE_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input 
                      type="tel" 
                      placeholder="6 12 34 56 78" 
                      value={newPatientData.phoneRaw}
                      onChange={e => setNewPatientData({...newPatientData, phoneRaw: formatPhoneDigits(e.target.value)})}
                    />
                  </div>
                  <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn-cancel" onClick={() => { setIsNewPatientModalOpen(false); setIsSmsModalOpen(false); }}>Annuler</button>
                    <button type="submit" className="btn-submit" style={{ flex: 1 }}>Enregistrer la fiche</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
