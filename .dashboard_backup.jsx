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
  const [selectedImage, setSelectedImage] = useState(null);
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

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({
          url: reader.result,
          name: file.name,
          size: file.size
        });
        setAnalysisResult(null);
      };
      reader.readAsDataURL(file);
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
    
    const newHistory = analysisResult ? [{
      date: new Date().toLocaleDateString(),
      image: selectedImage?.url,
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
      history: newHistory
    };
    
    const updatedPatients = [newPatient, ...patients];
    setPatients(updatedPatients);
    
    // Si on a sauvegardé une analyse en cours, on l'attache et on vide le dashboard
    if (analysisResult) {
      setSelectedImage(null);
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
      image: selectedImage?.url,
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
    
    setSelectedImage(null);
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
    if (!selectedImage) {
      alert("Veuillez d'abord importer une photo.");
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
      
      // 3. Préparer l'image en Base64
      const responseImg = await fetch(selectedImage.url);
      const blob = await responseImg.blob();
      const base64data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // 4. Appel à l'API Gemini 2.5 Flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          promptText,
          { inlineData: { data: base64data, mimeType: blob.type } }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text;
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
      
      <div className={`scanner-body ${selectedImage ? 'has-photo' : 'no-photo'}`}>
        {selectedImage && (
          <div className="upload-column glass-panel">
            <div className="upload-container compact" onClick={() => fileInputRef.current.click()}>
              <div className="uploaded-image-wrapper">
                <button className="remove-photo-btn" onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setAnalysisResult(null); }}>✕</button>
                <img src={selectedImage.url} alt="Scan preview" className="uploaded-image" />
                {isAnalyzing && <div className="scan-laser"></div>}
              </div>
            </div>
            <div className="upload-actions">
              <button className="change-photo-btn" onClick={() => fileInputRef.current.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Changer
              </button>
              <button className="save-patient-btn" onClick={() => setIsNewPatientModalOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Enregistrer
              </button>
            </div>
          </div>
        )}

        <div className="results-column glass-panel">
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
          
          <div className="action-row">
            {!selectedImage && (
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
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
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
        <button className="start-analysis-btn" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={() => setIsNewPatientModalOpen(true)}>
          + Nouveau Patient
        </button>
      </div>
      
      <div className="patients-layout">
        <div className="patient-list-column glass-panel" style={{padding: '1.5rem'}}>
          <input 
            type="text" 
            placeholder="Rechercher un patient..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="patient-search-input"
          />
          <div className="patient-scroll-area">
            {filteredPatients.map(patient => (
              <div key={patient.id} className={`patient-list-item ${selectedPatient?.id === patient.id ? 'active' : ''}`} onClick={() => setSelectedPatient(patient)}>
                <div className="patient-avatar-small">{patient.initial}</div>
                <div className="patient-info-row">
                  <h3>{patient.name}</h3>
                  <span className="patient-age">{patient.age} ans</span>
                </div>
                <div className="patient-date">{patient.date}</div>
                <span className={`status-badge ${patient.statusClass}`}>{patient.status}</span>
                <button 
                  className="delete-patient-btn" 
                  onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient.id); }}
                  title="Supprimer le patient"
                >✕</button>
              </div>
            ))}
            {filteredPatients.length === 0 && <p style={{opacity: 0.5, textAlign: 'center', marginTop: '2rem'}}>Aucun patient trouvé.</p>}
          </div>
        </div>

        <div className="patient-profile-column">
          {selectedPatient ? (
            <>
              <div className="patient-profile-header">
                <div className="patient-profile-avatar">{selectedPatient.initial}</div>
                <div>
                  <h2 style={{fontSize: '1.8rem', marginBottom: '0.5rem'}}>{selectedPatient.name}</h2>
                  <span className={`status-badge ${selectedPatient.statusClass}`}>{selectedPatient.status}</span>
                </div>
              </div>
              <div className="patient-profile-details">
                <div className="profile-field">
                  <label>Âge</label>
                  <span>{selectedPatient.age} ans</span>
                </div>
                <div className="profile-field">
                  <label>Dernière visite</label>
                  <span>{selectedPatient.date}</span>
                </div>
                <div className="profile-field">
                  <label>Email</label>
                  <span>{selectedPatient.email}</span>
                </div>
                <div className="profile-field">
                  <label>Téléphone</label>
                  <span>{selectedPatient.phone}</span>
                </div>
              </div>
              
              {selectedPatient.history && selectedPatient.history.length > 0 && (
                <div className="patient-history">
                  <h3 style={{marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Dossier Médical & Photos</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                    {selectedPatient.history.map((h, i) => (
                      <div key={i} style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem'}}>
                          <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Consultation du {h.date}</span>
                        </div>
                        
                        <div style={{display: 'flex', gap: '1.5rem', alignItems: 'flex-start'}}>
                          {h.image && (
                            <div style={{flexShrink: 0, width: '150px', height: '150px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)'}}>
                              <img src={h.image} alt="Photo patient" style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
                            </div>
                          )}
                          <div style={{flex: 1}}>
                            {h.analysis ? (
                              <>
                                <h4 style={{fontSize: '1rem', color: 'var(--accent-cyan)', marginBottom: '0.5rem'}}>Bilan Biométrique</h4>
                                <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem'}}>
                                  <span style={{background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px'}}>Hydratation: {h.analysis.hydration}</span>
                                  <span style={{background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px'}}>pH: {h.analysis.ph}</span>
                                  <span style={{background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px'}}>Élasticité: {h.analysis.elasticity}</span>
                                </div>
                                
                                <h4 style={{fontSize: '1rem', color: '#fff', marginBottom: '0.5rem'}}>Diagnostic IA</h4>
                                <div style={{fontSize: '0.95rem', lineHeight: '1.6', color: '#e0e0e0', marginBottom: '1rem'}}>
                                  {Array.isArray(h.analysis.diagnosis) 
                                    ? h.analysis.diagnosis.map((d, dIdx) => <div key={dIdx} style={{marginBottom: '0.5rem'}}><strong>{d.title}:</strong> {renderTextWithBold(d.description)}</div>)
                                    : <p>{renderTextWithBold(h.analysis.diagnosis)}</p>
                                  }
                                </div>

                                <h4 style={{fontSize: '1rem', color: '#fff', marginBottom: '0.5rem'}}>Traitements Recommandés</h4>
                                <div style={{fontSize: '0.95rem', lineHeight: '1.6', color: '#e0e0e0', marginBottom: '1rem'}}>
                                  {Array.isArray(h.analysis.treatments) 
                                    ? h.analysis.treatments.map((t, tIdx) => <div key={tIdx} style={{marginBottom: '0.5rem'}}><strong>{t.title || t}:</strong> {t.description ? renderTextWithBold(t.description) : ''}</div>)
                                    : <ul>{h.analysis.treatments && h.analysis.treatments.map((t, idx) => <li key={idx}>{renderTextWithBold(t)}</li>)}</ul>
                                  }
                                </div>
                                
                                <h4 style={{fontSize: '1rem', color: '#fff', marginBottom: '0.5rem'}}>Recommandation Globale</h4>
                                <p style={{fontSize: '0.95rem', lineHeight: '1.6', color: '#e0e0e0'}}>{renderTextWithBold(h.analysis.recommendation)}</p>
                              </>
                            ) : h.diagnosis ? (
                              <>
                                <h4 style={{fontSize: '1rem', color: '#fff', marginBottom: '0.5rem'}}>Diagnostic</h4>
                                <div style={{fontSize: '0.95rem', lineHeight: '1.6', color: '#e0e0e0', marginBottom: '1rem'}}>
                                  {Array.isArray(h.diagnosis) 
                                    ? h.diagnosis.map((d, dIdx) => <div key={dIdx}><strong>{d.title}:</strong> {renderTextWithBold(d.description)}</div>)
                                    : <p>{renderTextWithBold(h.diagnosis)}</p>
                                  }
                                </div>
                              </>
                            ) : (
                              <p style={{color: 'var(--text-muted)'}}>Aucune analyse détaillée enregistrée pour cette consultation.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center'}}>
              <p>Sélectionnez un patient à gauche pour afficher sa fiche détaillée.</p>
            </div>
          )}
        </div>
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
