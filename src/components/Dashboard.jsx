import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/bg.png';
import robotImg from '../assets/robot.png';

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
      setSelectedImage({
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size
      });
      setAnalysisResult(null);
    }
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
      diagnosis: analysisResult.diagnosis,
      recommendation: analysisResult.recommendation
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

Je veux une analyse extrêmement approfondie, détaillée et technique. Ne te contente pas de descriptions superficielles.
Le diagnostic doit expliquer l'étiologie possible, et les traitements doivent être un protocole clinique complet, étape par étape, incluant molécules actives, dosages ou techniques médicales (laser, peeling, etc.) justifiés.

Contexte PDF:
${pdfContext}

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure, en écrivant des paragraphes très longs, professionnels et argumentés pour les sections textuelles :
{
  "hydration": "Valeur (ex: 45%)",
  "ph": "Valeur (ex: 5.5)",
  "elasticity": "Valeur (ex: Bonne)",
  "aging": "Pourcentage (ex: 30%)",
  "agingDetails": "Analyse clinique exhaustive des signes de vieillissement (rides, ptôse, dommages actiniques), expliquant la physiopathologie.",
  "diagnosis": "Diagnostic clinique profond, exhaustif et argumenté justifiant précisément les observations visuelles.",
  "recommendation": "Recommandation générale et stratégie de prise en charge globale.",
  "treatments": ["Protocole médical détaillé 1 avec justification clinique complète", "Protocole médical détaillé 2 avec justification", "Protocole médical détaillé 3 avec justification"]
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
      
      <div className="scanner-body">
        <div className="upload-column glass-panel">
          <div className="upload-container compact" onClick={() => !selectedImage && fileInputRef.current.click()}>
            {selectedImage ? (
              <div className="uploaded-image-wrapper">
                <button className="remove-photo-btn" onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setAnalysisResult(null); }}>✕</button>
                <img src={selectedImage.url} alt="Scan preview" className="uploaded-image" />
                {isAnalyzing && <div className="scan-laser"></div>}
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon-ring">
                  <span className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </span>
                </div>
                <h3>Photo</h3>
                <span className="upload-subtext">Caméra ou Galerie</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              id="photo-upload"
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
          {selectedImage && (
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
          )}
        </div>

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
                  <h3 className="results-title">RÉSULTATS BIOMÉTRIQUES</h3>
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <span className="metric-label">HYDRATATION</span>
                      <span className="metric-value">{analysisResult.hydration}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">PH DERMIQUE</span>
                      <span className="metric-value">{analysisResult.ph}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">ÉLASTICITÉ</span>
                      <span className="metric-value">{analysisResult.elasticity}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>VIEILLISSEMENT CUTANÉ</h4>
                    <div className="aging-stats">
                      <div className="aging-stat"><span>Score</span><strong>{analysisResult.aging}</strong></div>
                    </div>
                    <p className="aging-details">{analysisResult.agingDetails}</p>
                  </div>

                  <div className="ai-diagnosis">
                    <h4>DIAGNOSTIC CLINIQUE (Croisé avec vos PDFs)</h4>
                    <p>{analysisResult.diagnosis}</p>
                  </div>
                </div>
              )}

              {resultTab === 'traitement' && (
                <div className="tab-content animate-fade-in">
                  <div className="ai-recommendation">
                    <h4>RECOMMANDATIONS</h4>
                    <p>{analysisResult.recommendation}</p>
                  </div>
                  <div className="treatment-details">
                    <h4>PROTOCOLES CLINIQUES</h4>
                    <ul>
                      {analysisResult.treatments.map((t, idx) => <li key={idx}>{t}</li>)}
                    </ul>
                  </div>
                  
                  <button 
                    className="start-analysis-btn" 
                    style={{marginTop: '1rem', background: 'transparent', border: '1px solid #ffffff', color: '#ffffff'}} 
                    onClick={() => setIsNewPatientModalOpen(true)}
                  >
                    CRÉER FICHE PATIENT ET SAUVEGARDER
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
          <button 
            className={`start-analysis-btn ${isAnalyzing ? 'analyzing' : ''} ${analysisResult ? 'success' : ''}`} 
            onClick={startAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "ANALYSE EN COURS..." : analysisResult ? "NOUVELLE ANALYSE" : "DÉMARRER L'ANALYSE"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatientsList = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header patients">
        <div className="title-area">
          <h2>LISTE DES <span className="brand-light">PATIENTS</span></h2>
          <p className="card-description">
            Sélectionnez un patient pour accéder à son dossier complet et ses analyses.
          </p>
        </div>
        <button className="premium-btn-small outline" onClick={() => setIsNewPatientModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'middle'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nouveau Patient
        </button>
      </div>
      
      <div className="patients-layout">
        <div className="patient-list-column glass-panel" style={{padding: '1.5rem'}}>
          {patients.map(patient => (
            <div key={patient.id} className={`patient-list-item ${selectedPatient?.id === patient.id ? 'active' : ''}`} onClick={() => setSelectedPatient(patient)}>
              <div className="patient-avatar-small">{patient.initial}</div>
              <div className="patient-info-row">
                <h3>{patient.name}</h3>
                <span className="patient-age">{patient.age} ans</span>
              </div>
              <div className="patient-date">{patient.date}</div>
              <span className={`status-badge ${patient.statusClass}`}>{patient.status}</span>
              <button className="view-btn-icon">➔</button>
            </div>
          ))}
          {patients.length === 0 && <p style={{opacity: 0.5, textAlign: 'center'}}>Aucun patient enregistré.</p>}
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
                  <h3 style={{marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Historique des Diagnostics</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {selectedPatient.history.map((h, i) => (
                      <div key={i} style={{background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                          <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{h.date}</span>
                        </div>
                        <p style={{fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '0.5rem'}}>{h.diagnosis}</p>
                        {h.image && <img src={h.image} alt="Historique" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', marginTop: '0.5rem'}}/>}
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
            <h3>Nouveau Patient</h3>
            <form className="modal-form" onSubmit={handleAddPatient}>
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
