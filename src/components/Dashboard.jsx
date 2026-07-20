import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/bg.png';
import robotImg from '../assets/robot.png';
import navbarImg from '../assets/navbar.png';

// Configuration du worker PDF.js via CDN pour éviter les problèmes de build Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function Dashboard({ onLogout }) {
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
  
  const [pdfs, setPdfs] = useState(() => {
    const saved = localStorage.getItem('dermaNovaPdfs');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('dermaNovaGeminiKey') || '');
  const [isKeySaved, setIsKeySaved] = useState(!!localStorage.getItem('dermaNovaGeminiKey'));

  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [newPatientData, setNewPatientData] = useState({ name: '', age: '', email: '', phone: '' });

  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Sauvegarde automatique lors des changements
  useEffect(() => {
    localStorage.setItem('dermaNovaPatients', JSON.stringify(patients));
  }, [patients]);

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
      phone: newPatientData.phone || 'Non renseigné',
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
    setNewPatientData({ name: '', age: '', email: '', phone: '' });
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

  const startAnalysis = async () => {
    if (selectedImages.length === 0) {
      alert("Veuillez d'abord importer au moins une photo.");
      return;
    }
    if (!geminiKey) {
      alert("Veuillez configurer votre clé API Gemini dans l'onglet Paramètres pour lancer une vraie analyse IA.");
      return;
    }
    
    setAnalysisResult(null);
    setResultTab('diagnostic');
    setIsAnalyzing(true);
    
    try {
      // 1. Construire le contexte PDF
      let pdfContext = "";
      if (pdfs.length > 0) {
        pdfContext = "Voici des extraits des ouvrages médicaux de référence fournis par le praticien. BASE TES CONCLUSIONS SUR CES OUVRAGES :\n\n" + 
          pdfs.map(p => `--- OUVRAGE: ${p.name} ---\n${p.content.substring(0, 8000)}`).join("\n\n");
      }

      const promptText = `Tu es un expert dermatologue mondialement reconnu.
Analyse cette image dermatologique du patient avec la plus grande précision clinique.
Base-toi EXCLUSIVEMENT sur les connaissances du document PDF fourni ci-dessous si elles sont pertinentes.

Je veux une analyse extrêmement approfondie, détaillée et technique pour le diagnostic et les traitements. Ne te contente pas de descriptions superficielles.
Le diagnostic doit expliquer l'étiologie possible, et les traitements doivent être un protocole clinique complet, étape par étape, incluant molécules actives, dosages ou techniques médicales (laser, peeling, etc.) justifiés.

Contexte PDF:
${pdfContext}

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure. 
ATTENTION: Pour les champs 'hydration', 'ph', 'elasticity' et 'aging', tu DOIS renvoyer une valeur très courte (ex: "45%", "5.5", "Moyenne", "30%"). Même si c'est difficile à évaluer sur photo, fais une déduction clinique experte et donne TOUJOURS une valeur estimée réaliste. Ne dis JAMAIS que c'est non mesurable ou "N/A". Ne mets JAMAIS de longues phrases dans ces champs.
En revanche, pour éviter les gros blocs de texte indigestes, structure tes réponses pour 'agingDetails', 'diagnosis' et 'treatments' sous forme de listes d'objets avec un 'title' (titre clair et concis) et une 'description' (explication détaillée). 
CRUCIAL: Dans les descriptions, mets **BEAUCOUP DE MOTS EN GRAS** (en les entourant de doubles astérisques **) pour mettre en valeur les mots-clés, les symptômes et les molécules, afin de faciliter la lecture en diagonale ! 
TRÈS IMPORTANT: NE METS AUCUN RETOUR À LA LIGNE (\n) NI CARACTÈRE DE CONTRÔLE DANS LES VALEURS DE TEXTE. LE JSON DOIT ÊTRE STRICTEMENT VALIDE.
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
        }
      });

      let resultText = response.text;
      
      // Nettoyage agressif pour éviter "Bad control character in string literal"
      // Supprime les balises markdown
      resultText = resultText.replace(/```json/gi, '').replace(/```/g, '');
      // Remplace les caractères de contrôle (comme les sauts de ligne littéraux) par un espace
      resultText = resultText.replace(/[\u0000-\u001F]+/g, ' ');

      const parsedJSON = JSON.parse(resultText);
      setAnalysisResult(parsedJSON);
      
    } catch (error) {
      alert("Erreur lors de l'analyse IA : " + error.message + "\n\nVérifiez que votre clé API est valide.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
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
      <div className="card-header">
        <h2>ANALYSE <span className="brand-light">DERMATOLOGIQUE</span></h2>
      </div>
      <p className="card-description">
        Importez ou prenez une photo directe. L'IA croisera les données visuelles avec vos documents PDF intégrés.
      </p>
      
      <div className={`scanner-body ${selectedImages.length > 0 ? 'has-photo' : 'no-photo'}`}>
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

        <div className={`results-column glass-panel ${!isAnalyzing && !analysisResult ? 'is-empty' : ''}`}>
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
                      <div className="metric-icon" style={{marginBottom: '0.8rem', color: '#ffbd2e'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                      </div>
                      <span className="metric-label">ÉLASTICITÉ</span>
                      <span className="metric-value">{analysisResult.elasticity}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>VIEILLISSEMENT CUTANÉ</h4>
                    <div className="aging-stats">
                      <div className="aging-stat"><span>Score</span><strong>{analysisResult.aging}</strong></div>
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
          ) : (
            <div className="waiting-state">
              <span className="waiting-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </span>
              <p>L'analyse détaillée du patient apparaîtra ici.</p>
            </div>
          )}
        </div>

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
            
            <div className="action-row">
              {(selectedImages.length < 5) && (
                <div className="small-upload" onClick={() => fileInputRef.current.click()}>
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
      </div>
    </div>
  );


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
      <div className="patient-drawer-container">
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
              <button className="btn-primary-clean">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Accéder au dossier médical
              </button>
              <button className="btn-secondary-clean" onClick={() => setIsPortalOpen(true)}>
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
      </div>
      </div> {/* Closes patients-layout */}

      {/* PORTAIL PATIENT MOCKUP (IMMERSION) */}
      {isPortalOpen && selectedPatient && (
        <div className="patient-portal-fullscreen animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'var(--bg-dark)', zIndex: 3000, overflowY: 'auto'
        }}>
          <div style={{maxWidth: '900px', margin: '0 auto', padding: '2rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem'}}>
              <h1 style={{fontSize: '2rem', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0}}>DermaNova</h1>
              <button onClick={() => setIsPortalOpen(false)} style={{background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>Quitter l'immersion</button>
            </div>
            
            <div style={{textAlign: 'center', marginBottom: '3rem'}}>
              <h2 style={{fontSize: '2.5rem', marginBottom: '1rem'}}>Bonjour {selectedPatient.name.split(' ')[0]}</h2>
              <p style={{fontSize: '1.2rem', color: 'var(--text-muted)'}}>Bienvenue dans votre espace de téléconsultation sécurisé. Pour assurer le suivi de votre traitement, veuillez procéder à une nouvelle analyse.</p>
            </div>

            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '2rem'}}>
              <button className="start-analysis-btn" style={{width: 'auto', padding: '1rem 2rem', fontSize: '1.2rem'}} onClick={() => {
                // Just scroll down to the scanner or rely on it being visible
                window.scrollTo({top: 500, behavior: 'smooth'});
              }}>
                Commencer ma téléconsultation
              </button>
            </div>

            <div className="portal-scanner-wrapper" style={{marginTop: '3rem', transform: 'scale(1)', transformOrigin: 'top center'}}>
              {renderScannerCard()}
            </div>
          </div>
        </div>
      )}
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

  return (
    <div className="dashboard-container" style={{ backgroundImage: `url(${bgImage})` }}>
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
            onClick={() => setActiveTab('dashboard')}
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
              <div className="dashboard-grid layout-single">
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

      {/* Modal Nouveau Patient */}
      {isNewPatientModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Sauvegarder le dossier</h3>
            
            {analysisResult && patients.length > 0 && (
              <div style={{marginBottom: '2rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1.5rem'}}>
                <h4 style={{color: '#121212', marginBottom: '0.8rem', fontSize: '1rem'}}>Ajouter à un patient existant :</h4>
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
            
            <h4 style={{color: '#121212', marginBottom: '0.8rem', fontSize: '1rem'}}>
              {analysisResult ? 'Ou créer un nouveau patient :' : 'Créer un nouveau patient :'}
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
              <input 
                type="tel" 
                placeholder="Téléphone" 
                value={newPatientData.phone}
                onChange={e => setNewPatientData({...newPatientData, phone: e.target.value})}
              />
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsNewPatientModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-submit">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
